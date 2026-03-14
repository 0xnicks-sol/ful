import { Server as SocketIOServer } from 'socket.io';
import prisma from '../config/database';
import logger from '../config/logger';

export interface LeaderboardEntry {
  walletAddress: string;
  wins: number;
  rank?: number;
}

class LeaderboardService {
  private io: SocketIOServer | null = null;

  /**
   * Initialize with Socket.IO instance
   */
  public initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('LeaderboardService initialized');
  }

  /**
   * Record a win for a wallet
   */
  async recordWin(walletAddress: string): Promise<void> {
    try {
      const existing = await prisma.leaderboard.findUnique({
        where: { walletAddress },
      });

      if (existing) {
        await prisma.leaderboard.update({
          where: { walletAddress },
          data: {
            wins: existing.wins + 1,
            lastWinAt: new Date(),
          },
        });
      } else {
        await prisma.leaderboard.create({
          data: {
            walletAddress,
            wins: 1,
            lastWinAt: new Date(),
          },
        });
      }

      logger.info(`📊 Win recorded for ${walletAddress}`);

      // Broadcast updated leaderboard
      await this.broadcastLeaderboard();
    } catch (error: any) {
      logger.error('Error recording win:', error);
      throw error;
    }
  }

  /**
   * Get top N rankings
   */
  async getTopRankings(limit: number = 10): Promise<LeaderboardEntry[]> {
    const entries = await prisma.leaderboard.findMany({
      take: limit,
      orderBy: [{ wins: 'desc' }, { lastWinAt: 'asc' }],
      select: {
        walletAddress: true,
        wins: true,
      },
    });

    // Add rank
    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  /**
   * Get top 3 winners for reward distribution
   */
  async getTop3Winners(): Promise<string[]> {
    const top3 = await prisma.leaderboard.findMany({
      take: 3,
      orderBy: [{ wins: 'desc' }, { lastWinAt: 'asc' }],
      select: {
        walletAddress: true,
      },
    });

    return top3.map((entry) => entry.walletAddress);
  }

  /**
   * Get rank for specific wallet
   */
  async getRank(walletAddress: string): Promise<number | null> {
    const entry = await prisma.leaderboard.findUnique({
      where: { walletAddress },
    });

    if (!entry) return null;

    // Count how many have more wins or same wins but earlier lastWinAt
    const rankCount = await prisma.leaderboard.count({
      where: {
        OR: [
          { wins: { gt: entry.wins } },
          {
            wins: entry.wins,
            lastWinAt: { lt: entry.lastWinAt || new Date() },
          },
        ],
      },
    });

    return rankCount + 1;
  }

  /**
   * Broadcast current leaderboard to all clients
   */
  async broadcastLeaderboard(): Promise<void> {
    if (!this.io) return;

    const top10 = await this.getTopRankings(10);
    this.io.emit('leaderboard-update', top10);
  }

  /**
   * Reset leaderboard (new tournament)
   */
  async resetLeaderboard(): Promise<void> {
    await prisma.leaderboard.deleteMany({});
    logger.warn('🔄 Leaderboard reset');

    if (this.io) {
      this.io.emit('leaderboard-update', []);
    }
  }

  /**
   * Get total participants count
   */
  async getTotalParticipants(): Promise<number> {
    return await prisma.leaderboard.count();
  }
}

// Export singleton instance
export const leaderboardService = new LeaderboardService();
export default leaderboardService;
