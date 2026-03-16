import { Server as SocketIOServer } from 'socket.io';
import prisma from '../config/database';
import logger from '../config/logger';

export interface LeaderboardEntry {
  rank:         number;
  walletAddress: string;
  wins:          number;
  lastWinAt?:    Date | null;
  roundWon?:     number;   // most recent round this wallet won
}

class LeaderboardService {
  private io: SocketIOServer | null = null;

  public initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('LeaderboardService initialized');
  }

  /**
   * Record a round win for a wallet address and persist to DB.
   * Called by battle-engine after every round concludes.
   *
   * @param walletAddress  winner's Solana wallet
   * @param roundId        the round number they won
   */
  async recordWin(walletAddress: string, roundId: number): Promise<void> {
    try {
      const existing = await prisma.leaderboard.findUnique({ where: { walletAddress } });

      if (existing) {
        await prisma.leaderboard.update({
          where: { walletAddress },
          data:  { wins: existing.wins + 1, lastWinAt: new Date() },
        });
      } else {
        await prisma.leaderboard.create({
          data: { walletAddress, wins: 1, lastWinAt: new Date() },
        });
      }

      logger.info(`📊 Win recorded — wallet: ${walletAddress.slice(0, 8)}... round: ${roundId}`);

      // Broadcast updated leaderboard to all connected clients
      await this.broadcastLeaderboard();
    } catch (error: any) {
      logger.error('Error recording win:', error);
      throw error;
    }
  }

  /**
   * Return top N leaderboard entries (with rank numbers) from DB.
   */
  async getTopRankings(limit: number = 10): Promise<LeaderboardEntry[]> {
    const entries = await prisma.leaderboard.findMany({
      take:    limit,
      orderBy: [{ wins: 'desc' }, { lastWinAt: 'asc' }],
      select:  { walletAddress: true, wins: true, lastWinAt: true },
    });

    return entries.map((e, i) => ({
      rank:         i + 1,
      walletAddress: e.walletAddress,
      wins:          e.wins,
      lastWinAt:     e.lastWinAt,
    }));
  }

  /**
   * Return per-round winner list — one entry per completed round.
   * Sourced from the Battle table (winnerAddress + roundId + completedAt).
   */
  async getRoundWinners(): Promise<Array<{ round: number; walletAddress: string; completedAt: Date | null }>> {
    const battles = await prisma.battle.findMany({
      where:   { status: 'COMPLETE', winnerAddress: { not: null } },
      orderBy: { roundId: 'asc' },
      select:  { roundId: true, winnerAddress: true, completedAt: true },
    });

    return battles.map((b) => ({
      round:         b.roundId,
      walletAddress: b.winnerAddress as string,
      completedAt:   b.completedAt,
    }));
  }

  /**
   * Get top 3 winners for reward distribution.
   */
  async getTop3Winners(): Promise<string[]> {
    const top3 = await prisma.leaderboard.findMany({
      take:    3,
      orderBy: [{ wins: 'desc' }, { lastWinAt: 'asc' }],
      select:  { walletAddress: true },
    });
    return top3.map((e) => e.walletAddress);
  }

  /**
   * Get rank position for a specific wallet.
   */
  async getRank(walletAddress: string): Promise<number | null> {
    const entry = await prisma.leaderboard.findUnique({ where: { walletAddress } });
    if (!entry) return null;

    const above = await prisma.leaderboard.count({
      where: {
        OR: [
          { wins: { gt: entry.wins } },
          { wins: entry.wins, lastWinAt: { lt: entry.lastWinAt ?? new Date() } },
        ],
      },
    });

    return above + 1;
  }

  /**
   * Broadcast the latest leaderboard (with ranks) to all connected clients.
   */
  async broadcastLeaderboard(): Promise<void> {
    if (!this.io) return;
    const rankings = await this.getTopRankings(10);
    this.io.emit('leaderboard-update', rankings);
  }

  /**
   * Reset leaderboard (start of a new tournament).
   */
  async resetLeaderboard(): Promise<void> {
    await prisma.leaderboard.deleteMany({});
    logger.warn('🔄 Leaderboard reset');
    if (this.io) this.io.emit('leaderboard-update', []);
  }

  async getTotalParticipants(): Promise<number> {
    return await prisma.leaderboard.count();
  }
}

export const leaderboardService = new LeaderboardService();
export default leaderboardService;
