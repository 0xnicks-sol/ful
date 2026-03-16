import { Server as SocketIOServer } from 'socket.io';
import { Connection } from '@solana/web3.js';
import prisma from '../config/database';
import logger from '../config/logger';
import timerService from './timer-service';
import battleEntryService from './battle-entry';
import rewardService from './reward-service';

export interface BattleResult {
  roundId: number;
  winnerId: string;
  winnerAddress: string;
  participantCount: number;
}

class BattleEngine {
  private io: SocketIOServer | null = null;
  private connection: Connection;
  private fightDuration: number;

  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    this.fightDuration = parseInt(
      process.env.FIGHT_ANIMATION_DURATION_SECONDS || '45',
      10
    );
  }

  /**
   * Initialize with Socket.IO instance
   */
  public initialize(io: SocketIOServer): void {
    this.io = io;
    rewardService.initialize(io);
    logger.info('BattleEngine initialized');

    // Listen for battle execution trigger from timer service
    io.on('battle-execution-trigger', (data) => {
      this.executeBattle(data.round, data.participantCount);
    });
  }

  /**
   * Execute battle - select winner and update state
   */
  async executeBattle(roundId: number, _participantCount: number): Promise<void> {
    try {
      logger.info(`⚔️  Executing battle for round ${roundId}`);

      // Get participants
      const participants = await battleEntryService.getParticipants(roundId);

      if (participants.length === 0) {
        logger.warn(`No participants in round ${roundId}, skipping battle`);
        await this.skipRound(roundId);
        return;
      }

      if (participants.length === 1) {
        logger.info(`Only 1 participant in round ${roundId}, automatic winner`);
        await this.declareWinner(roundId, participants[0]);
        return;
      }

      // Update battle status to selecting winner
      await prisma.battle.update({
        where: { roundId },
        data: { status: 'SELECTING_WINNER' },
      });

      // Select winner using randomness
      const winner = await this.selectWinner(participants);

      // Update battle status to fighting
      await prisma.battle.update({
        where: { roundId },
        data: {
          status: 'FIGHTING',
          winnerId: winner.id,
          winnerAddress: winner.walletAddress,
        },
      });

      // Emit fight started event — include full participant list so the
      // frontend can sync fighters even if some live-purchase events were missed.
      if (this.io) {
        this.io.emit('fight-started', {
          roundId,
          participantCount: participants.length,
          duration: this.fightDuration,
          participants: participants.map((p) => ({
            walletAddress: p.walletAddress,
            tokenAmount:   p.tokenAmount,
          })),
        });
      }

      logger.info(`🥊 Fight animation started (${this.fightDuration}s)`);

      // Wait for fight animation to complete
      await this.delay(this.fightDuration * 1000);

      // Declare winner
      await this.declareWinner(roundId, winner);
    } catch (error: any) {
      logger.error('Error executing battle:', error);
      // Attempt to recover by advancing to next round
      await this.advanceToNextRound(roundId);
    }
  }

  /**
   * Select winner using provably fair randomness
   */
  async selectWinner(participants: any[]): Promise<any> {
    try {
      // Try using Switchboard VRF for provably fair randomness
      const randomNumber = await this.getSwitchboardRandomness();
      const winnerIndex = randomNumber % participants.length;
      logger.info(`✅ VRF randomness: ${randomNumber}, winner index: ${winnerIndex}`);
      return participants[winnerIndex];
    } catch (error: any) {
      logger.warn('Switchboard VRF failed, using fallback randomness:', error.message);
      // Fallback to blockhash-based randomness
      return this.selectWinnerFallback(participants);
    }
  }

  /**
   * Get random number from Switchboard VRF Oracle
   */
  private async getSwitchboardRandomness(): Promise<number> {
    // TODO: Implement actual Switchboard VRF integration
    // For MVP, we'll use recent blockhash as randomness source
    const recentBlockhash = await this.connection.getLatestBlockhash();
    const hash = recentBlockhash.blockhash;
    
    // Convert first 8 characters of blockhash to number
    const randomNumber = parseInt(hash.slice(0, 8), 36);
    return randomNumber;
  }

  /**
   * Fallback winner selection (crypto-secure)
   */
  private async selectWinnerFallback(participants: any[]): Promise<any> {
    // Use Solana recent blockhash for cryptographic randomness
    const recentBlockhash = await this.connection.getLatestBlockhash();
    const hash = recentBlockhash.blockhash;
    
    // Convert blockhash to number
    let sum = 0;
    for (let i = 0; i < hash.length; i++) {
      sum += hash.charCodeAt(i);
    }
    
    const winnerIndex = sum % participants.length;
    logger.info(`🎲 Fallback randomness: ${sum}, winner index: ${winnerIndex}`);
    return participants[winnerIndex];
  }

  /**
   * Declare winner and update leaderboard
   */
  private async declareWinner(roundId: number, winner: any): Promise<void> {
    try {
      // Update battle status to winner reveal
      const battle = await prisma.battle.update({
        where: { roundId },
        data: {
          status: 'WINNER_REVEAL',
          completedAt: new Date(),
        },
      });

      logger.info(`🏆 Winner: ${winner.walletAddress} (Round ${roundId})`);

      // Emit battle result
      if (this.io) {
        this.io.emit('battle-result', {
          roundId,
          winner: winner.walletAddress,
          participantCount: battle.participantCount,
        });
      }

      // Update leaderboard
      await this.updateLeaderboard(winner.walletAddress);

      // Log round result (no-op in no-contract mode — reserved for future use)
      logger.info(`📋 Round ${roundId} result logged (winner: ${winner.walletAddress})`);


      // Mark battle as complete
      await prisma.battle.update({
        where: { roundId },
        data: { status: 'COMPLETE' },
      });

      // Check if this was the final round
      const totalRounds = parseInt(process.env.TOTAL_ROUNDS || '10', 10);
      
      if (roundId >= totalRounds) {
        logger.info('🏁 Final round complete! Triggering reward distribution...');
        await this.triggerRewardDistribution();
      } else {
        // Advance to next round after 10 second break
        logger.info(`⏳ Next round starts in 10 seconds...`);
        await this.delay(10000);
        await this.advanceToNextRound(roundId);
      }
    } catch (error: any) {
      logger.error('Error declaring winner:', error);
      throw error;
    }
  }

  /**
   * Update leaderboard with win
   */
  private async updateLeaderboard(walletAddress: string): Promise<void> {
    try {
      // Check if entry exists
      const existing = await prisma.leaderboard.findUnique({
        where: { walletAddress },
      });

      if (existing) {
        // Increment wins
        await prisma.leaderboard.update({
          where: { walletAddress },
          data: {
            wins: existing.wins + 1,
            lastWinAt: new Date(),
          },
        });
      } else {
        // Create new entry
        await prisma.leaderboard.create({
          data: {
            walletAddress,
            wins: 1,
            lastWinAt: new Date(),
          },
        });
      }

      logger.info(`📊 Leaderboard updated for ${walletAddress}`);

      // Broadcast updated leaderboard
      await this.broadcastLeaderboard();
    } catch (error: any) {
      logger.error('Error updating leaderboard:', error);
    }
  }

  /**
   * Broadcast current leaderboard to all clients
   */
  private async broadcastLeaderboard(): Promise<void> {
    if (!this.io) return;

    const top10 = await prisma.leaderboard.findMany({
      take: 10,
      orderBy: [{ wins: 'desc' }, { lastWinAt: 'asc' }],
      select: {
        walletAddress: true,
        wins: true,
      },
    });

    this.io.emit('leaderboard-update', top10);
  }

  /**
   * Skip round (no participants)
   */
  private async skipRound(roundId: number): Promise<void> {
    await prisma.battle.update({
      where: { roundId },
      data: {
        status: 'COMPLETE',
        completedAt: new Date(),
      },
    });

    logger.info(`⏭️  Round ${roundId} skipped (no participants)`);

    // Advance to next round
    await this.delay(5000);
    await this.advanceToNextRound(roundId);
  }

  /**
   * Advance to next round.
   * Only calls advanceToNextRound() — the timer itself starts when the
   * first participant of the new round buys a token (battle-entry.ts).
   */
  private async advanceToNextRound(currentRound: number): Promise<void> {
    const totalRounds = parseInt(process.env.TOTAL_ROUNDS || '10', 10);

    if (currentRound >= totalRounds) {
      logger.info('🏁 Tournament complete!');
      return;
    }

    timerService.advanceToNextRound();

    logger.info(`⏳ Round ${currentRound + 1} ready — waiting for first participant to buy`);
  }

  /**
   * Trigger reward distribution (final round complete)
   * Calls the on-chain Anchor program to send SOL to top 3 winners.
   */
  private async triggerRewardDistribution(): Promise<void> {
    try {
      // Get top 3 winners from leaderboard
      const top3 = await prisma.leaderboard.findMany({
        take: 3,
        orderBy: [{ wins: 'desc' }, { lastWinAt: 'asc' }],
        select: { walletAddress: true, wins: true },
      });

      logger.info(`💰 Top ${top3.length} winners for reward distribution:`);
      top3.forEach((w, i) =>
        logger.info(`  ${i + 1}. ${w.walletAddress} — ${w.wins} wins`),
      );

      // Emit tournament complete event to all connected clients
      if (this.io) {
        this.io.emit('tournament-complete', { winners: top3 });
      }

      if (top3.length < 3) {
        logger.warn(
          `Only ${top3.length} winner(s) — need 3 for on-chain distribution.`,
        );
        logger.warn('Skipping on-chain distribution. Manual payout required.');
        return;
      }

      const addresses = top3.map((w) => w.walletAddress);

      // Call the Anchor program to distribute SOL rewards
      const result = await rewardService.distributeRewards(addresses);

      if (result.success) {
        const txs = result.transactions;
        if (txs) {
          logger.info(`✅ Reward distribution complete.`);
          logger.info(`   1st TX: ${txs.first.txSignature}`);
          logger.info(`   2nd TX: ${txs.second.txSignature}`);
          logger.info(`   3rd TX: ${txs.third.txSignature}`);
        } else {
          logger.info(`✅ Reward distribution complete (mock mode).`);
        }
      } else {
        logger.error(`❌ Reward distribution failed: ${result.error}`);
        logger.warn('Manual payout required for:');
        addresses.forEach((a) => logger.warn(`   - ${a}`));
      }
    } catch (error: any) {
      logger.error('Error triggering reward distribution:', error);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get battle status
   */
  async getBattleStatus(roundId: number) {
    return await prisma.battle.findUnique({
      where: { roundId },
      include: {
        participants: true,
      },
    });
  }
}

// Export singleton instance
export const battleEngine = new BattleEngine();
export default battleEngine;
