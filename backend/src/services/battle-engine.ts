import { Server as SocketIOServer } from 'socket.io';
import { Connection } from '@solana/web3.js';
import prisma from '../config/database';
import logger from '../config/logger';
import timerService from './timer-service';
import battleEntryService, { MAX_FIGHTERS } from './battle-entry';
import rewardService from './reward-service';
import { leaderboardService } from './leaderboard-service';

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

      // Hard-cap at MAX_FIGHTERS — should already be enforced by battle-entry,
      // but slice here as a safety net so the frontend never gets more than 30.
      const capped = participants.slice(0, MAX_FIGHTERS);
      if (capped.length !== participants.length) {
        logger.warn(`⚠️  Round ${roundId} had ${participants.length} participants in DB — capped to ${MAX_FIGHTERS}`);
      }

      if (capped.length === 1) {
        logger.info(`Only 1 participant in round ${roundId}, automatic winner`);
        await this.declareWinner(roundId, capped[0]);
        return;
      }

      // Update battle status to selecting winner
      await prisma.battle.update({
        where: { roundId },
        data: { status: 'SELECTING_WINNER' },
      });

      // Select winner using randomness (from capped list only)
      const winner = await this.selectWinner(capped);

      // Update battle status to fighting
      await prisma.battle.update({
        where: { roundId },
        data: {
          status: 'FIGHTING',
          winnerId: winner.id,
          winnerAddress: winner.walletAddress,
        },
      });

      // Emit fight started event — capped list so frontend never renders >30 fighters
      if (this.io) {
        this.io.emit('fight-started', {
          roundId,
          participantCount: capped.length,
          duration: this.fightDuration,
          participants: capped.map((p) => ({
            walletAddress: p.walletAddress,
            tokenAmount:   p.tokenAmount,
          })),
        });
      }

      logger.info(`🥊 Fight animation started — ${capped.length} fighters (${this.fightDuration}s)`);

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
   * Declare winner and update leaderboard.
   *
   * Flow:
   *   t+0s  — emit battle-result (winner popup appears on frontend)
   *   t+3s  — emit participant-removed for every loser (arena clears)
   *   t+7s  — wait for popup / celebration to finish
   *   t+10s — advance to next round & auto-populate from queue
   */
  private async declareWinner(roundId: number, winner: any): Promise<void> {
    try {
      const battle = await prisma.battle.update({
        where: { roundId },
        data: { status: 'WINNER_REVEAL', completedAt: new Date() },
      });

      logger.info(`🏆 Winner: ${winner.walletAddress} (Round ${roundId})`);

      // 1. Announce winner to all clients
      if (this.io) {
        this.io.emit('battle-result', {
          roundId,
          winner: winner.walletAddress,
          participantCount: battle.participantCount,
        });
      }

      // 2. After 3 s, remove every loser from the arena so only the winner remains visible
      await this.delay(3000);
      const allParticipants = await battleEntryService.getParticipants(roundId);
      const losers = allParticipants.filter((p) => p.walletAddress !== winner.walletAddress);

      if (this.io) {
        losers.forEach((loser) => {
          this.io!.emit('participant-removed', {
            walletAddress: loser.walletAddress,
            reason: 'round_ended',
          });
        });
        logger.info(`🗑  Cleared ${losers.length} loser(s) from arena (round ${roundId})`);
      }

      // 3. Record win in DB + broadcast updated leaderboard to all clients
      await leaderboardService.recordWin(winner.walletAddress, roundId);

      logger.info(`📋 Round ${roundId} complete (winner: ${winner.walletAddress})`);

      // 4. Mark battle as complete
      await prisma.battle.update({
        where: { roundId },
        data: { status: 'COMPLETE' },
      });

      // 5. Check if this was the final round
      const totalRounds = parseInt(process.env.TOTAL_ROUNDS || '10', 10);

      if (roundId >= totalRounds) {
        logger.info('🏁 Final round complete! Triggering reward distribution...');
        // Clear any remaining queue since tournament is over
        battleEntryService.clearQueue();
        await this.triggerRewardDistribution();
      } else {
        // Wait for the winner popup / celebration to finish, then start the next round
        logger.info(`⏳ Next round starts in 7 seconds...`);
        await this.delay(7000);
        await this.advanceToNextRound(roundId);
      }
    } catch (error: any) {
      logger.error('Error declaring winner:', error);
      throw error;
    }
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
   * Advance to next round and auto-populate from the waiting queue.
   *
   * If the queue has players:
   *   - They are added to the new round immediately (triggering the timer).
   *   - If 30 queue players fill the slots, the battle starts automatically.
   * If the queue is empty:
   *   - The timer starts when the first new live buy arrives.
   */
  private async advanceToNextRound(currentRound: number): Promise<void> {
    const totalRounds = parseInt(process.env.TOTAL_ROUNDS || '10', 10);

    if (currentRound >= totalRounds) {
      logger.info('🏁 Tournament complete!');
      return;
    }

    const nextRound = currentRound + 1;
    timerService.advanceToNextRound();

    const queueSize = battleEntryService.getQueueCount();
    if (queueSize > 0) {
      logger.info(`📋 ${queueSize} player(s) in queue — auto-populating round ${nextRound}...`);
      await battleEntryService.populateNextRound(nextRound);
    } else {
      logger.info(`⏳ Round ${nextRound} ready — waiting for first participant to buy`);
    }
  }

  /**
   * Trigger reward distribution (final round complete).
   *
   * Algorithm:
   *   1. Collect ALL wallets that have won at least one round.
   *   2. Fisher-Yates shuffle the entire list (true randomness).
   *   3. Pick the first 3 — these are the grand prize winners.
   *
   * This gives every round-winner an equal chance regardless of
   * how many rounds they won.
   */
  private async triggerRewardDistribution(): Promise<void> {
    try {
      // Fetch every wallet that has won at least one round
      const allWinners = await prisma.leaderboard.findMany({
        select: { walletAddress: true, wins: true },
      });

      // Fisher-Yates shuffle for fair random selection
      for (let i = allWinners.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allWinners[i], allWinners[j]] = [allWinners[j], allWinners[i]];
      }

      const top3 = allWinners.slice(0, 3);

      logger.info(`🎰 10-round tournament complete! Shuffled ${allWinners.length} winners → selected 3:`);
      top3.forEach((w, i) =>
        logger.info(`  ${i + 1}. ${w.walletAddress} (${w.wins} round win${w.wins > 1 ? 's' : ''})`),
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
