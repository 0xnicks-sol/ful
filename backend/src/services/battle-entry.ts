import { Server as SocketIOServer } from 'socket.io';
import prisma from '../config/database';
import logger from '../config/logger';
import timerService from './timer-service';

export interface ParticipantData {
  walletAddress: string;
  txSignature: string;
  tokenAmount: number;
}

class BattleEntryService {
  private io: SocketIOServer | null = null;

  /**
   * Initialize with Socket.IO instance
   */
  public initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('BattleEntryService initialized');
  }

  /**
   * Record participation (auto-triggered by token purchase)
   */
  async recordParticipation(
    walletAddress: string,
    txSignature: string,
    tokenAmount: number,
    roundId: number
  ): Promise<boolean> {
    try {
      const MAX_FIGHTERS = 30;

      if (timerService.isActive()) {
        // ── Entry window is open ───────────────────────────────────────────
        if (timerService.getTimerState().participantCount >= MAX_FIGHTERS) {
          logger.warn(`Round ${roundId} full (${MAX_FIGHTERS} max). ${walletAddress.slice(0,8)} queued for next round.`);
          return false;
        }
        // Fall through to participant creation below
      } else if (!timerService.isFightInProgress()) {
        // ── Timer not started yet (IDLE) — this is the FIRST participant ──
        logger.info(`🔔 First participant! Starting 60s entry window for round ${roundId}...`);
        timerService.startTimer(roundId);
        // Fall through to participant creation below
      } else {
        // ── Fight is in progress (hasEnded = true) — reject ───────────────
        logger.warn(`Cannot join: Fight already in progress for round ${roundId}`);
        return false;
      }

      // Get current battle
      const battle = await this.getOrCreateBattle(roundId);

      // Check if already participated
      const existing = await prisma.participant.findUnique({
        where: {
          battleId_walletAddress: {
            battleId: battle.id,
            walletAddress,
          },
        },
      });

      if (existing) {
        logger.warn(`${walletAddress} already joined round ${roundId}`);
        return false;
      }

      // Create participant entry
      await prisma.participant.create({
        data: {
          battleId: battle.id,
          walletAddress,
          txSignature,
          tokenAmount,
        },
      });

      // Update battle participant count
      await prisma.battle.update({
        where: { id: battle.id },
        data: {
          participantCount: {
            increment: 1,
          },
        },
      });

      // Increment timer service count
      timerService.incrementParticipantCount();

      logger.info(`✅ Participant joined: ${walletAddress} (Round ${roundId})`);

      // Broadcast to all clients — emit FULL wallet so frontend can match battle-result winner
      if (this.io) {
        this.io.emit('participant-joined', {
          count:        timerService.getTimerState().participantCount,
          walletAddress: walletAddress,
          walletShort:   this.truncateAddress(walletAddress),
          tokenAmount,
        });
      }

      return true;
    } catch (error: any) {
      logger.error('Error recording participation:', error);
      throw error;
    }
  }

  /**
   * Remove participant (when token is sold)
   */
  async removeParticipant(walletAddress: string): Promise<void> {
    try {
      const currentRound = timerService.getCurrentRound();
      const battle = await prisma.battle.findUnique({
        where: { roundId: currentRound },
      });

      if (!battle) return;

      // Delete participant
      const deleted = await prisma.participant.deleteMany({
        where: {
          battleId: battle.id,
          walletAddress,
        },
      });

      if (deleted.count > 0) {
        // Update battle participant count
        await prisma.battle.update({
          where: { id: battle.id },
          data: {
            participantCount: {
              decrement: deleted.count,
            },
          },
        });

        logger.warn(`❌ Removed participant: ${walletAddress} (Token sold)`);

        // Broadcast removal — full walletAddress so frontend can match & remove
        if (this.io) {
          this.io.emit('participant-removed', {
            walletAddress,
            reason: 'token_sold',
          });
        }
      }
    } catch (error: any) {
      logger.error('Error removing participant:', error);
    }
  }

  /**
   * Get participants for a round
   */
  async getParticipants(roundId: number) {
    const battle = await prisma.battle.findUnique({
      where: { roundId },
      include: {
        participants: true,
      },
    });

    return battle?.participants || [];
  }

  /**
   * Get or create battle for round
   */
  private async getOrCreateBattle(roundId: number) {
    let battle = await prisma.battle.findUnique({
      where: { roundId },
    });

    if (!battle) {
      battle = await prisma.battle.create({
        data: {
          roundId,
          status: 'TIMER_ACTIVE',
          startedAt: new Date(),
        },
      });
      logger.info(`Created battle for round ${roundId}`);
    }

    return battle;
  }

  /**
   * Truncate wallet address for display
   */
  private truncateAddress(address: string): string {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  /**
   * Check if wallet has joined current round
   */
  async hasJoined(walletAddress: string, roundId: number): Promise<boolean> {
    const battle = await prisma.battle.findUnique({
      where: { roundId },
    });

    if (!battle) return false;

    const participant = await prisma.participant.findUnique({
      where: {
        battleId_walletAddress: {
          battleId: battle.id,
          walletAddress,
        },
      },
    });

    return !!participant;
  }
}

// Export singleton instance
export const battleEntryService = new BattleEntryService();
export default battleEntryService;
