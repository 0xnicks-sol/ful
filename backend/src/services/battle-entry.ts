import { Server as SocketIOServer } from 'socket.io';
import prisma from '../config/database';
import logger from '../config/logger';
import timerService from './timer-service';

export const MAX_FIGHTERS = 30;

export interface ParticipantData {
  walletAddress: string;
  txSignature: string;
  tokenAmount: number;
}

interface QueuedPlayer {
  walletAddress: string;
  txSignature: string;
  tokenAmount: number;
  queuedAt: Date;
}

class BattleEntryService {
  private io: SocketIOServer | null = null;

  /**
   * In-memory queue for players who bought while the current round was full.
   * They will be added to the NEXT round automatically.
   */
  private waitingQueue: QueuedPlayer[] = [];

  public initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('BattleEntryService initialized');
  }

  /**
   * Record participation (auto-triggered by token purchase).
   *
   * @param fromQueue - When true the call comes from populateNextRound(); skip
   *                    the auto-forceEnd so we batch-check after all 30 are added.
   */
  async recordParticipation(
    walletAddress: string,
    txSignature: string,
    tokenAmount: number,
    roundId: number,
    fromQueue = false,
  ): Promise<boolean> {
    try {
      if (timerService.isActive()) {
        // ── Entry window is open ─────────────────────────────────────────────
        if (timerService.getTimerState().participantCount >= MAX_FIGHTERS) {
          if (!fromQueue) {
            this.addToQueue(walletAddress, txSignature, tokenAmount);
          }
          return false;
        }
        // Fall through to participant creation
      } else if (!timerService.isFightInProgress()) {
        // ── IDLE — this is the first participant; start the entry window ──────
        logger.info(`🔔 First participant! Starting 60s entry window for round ${roundId}...`);
        timerService.startTimer(roundId);
        // Fall through to participant creation
      } else {
        // ── Fight in progress — queue for next round ──────────────────────────
        if (!fromQueue) {
          this.addToQueue(walletAddress, txSignature, tokenAmount);
        }
        return false;
      }

      // Get or create battle record
      const battle = await this.getOrCreateBattle(roundId);

      // ── DB-level cap (guards against in-memory count going stale after restart) ─
      const dbCount = await prisma.participant.count({ where: { battleId: battle.id } });
      if (dbCount >= MAX_FIGHTERS) {
        if (!fromQueue) this.addToQueue(walletAddress, txSignature, tokenAmount);
        return false;
      }

      // Deduplicate
      const existing = await prisma.participant.findUnique({
        where: { battleId_walletAddress: { battleId: battle.id, walletAddress } },
      });
      if (existing) {
        logger.warn(`${walletAddress} already joined round ${roundId}`);
        return false;
      }

      // Persist participant
      await prisma.participant.create({
        data: { battleId: battle.id, walletAddress, txSignature, tokenAmount },
      });

      await prisma.battle.update({
        where: { id: battle.id },
        data: { participantCount: { increment: 1 } },
      });

      timerService.incrementParticipantCount();
      const currentCount = timerService.getTimerState().participantCount;

      logger.info(`✅ Participant joined: ${walletAddress.slice(0, 8)}... (Round ${roundId}, #${currentCount})`);

      if (this.io) {
        this.io.emit('participant-joined', {
          count:         currentCount,
          walletAddress,
          walletShort:   this.truncateAddress(walletAddress),
          tokenAmount,
        });
      }

      // ── Auto-start battle when 30 players are in (live buys only) ───────────
      if (!fromQueue && currentCount >= MAX_FIGHTERS) {
        logger.info(`🎯 30/30 participants reached — force-starting battle now!`);
        timerService.forceEnd();
      }

      return true;
    } catch (error: any) {
      logger.error('Error recording participation:', error);
      throw error;
    }
  }

  /**
   * Push a player into the waiting queue (next round).
   * Emits `participant-queued` so the frontend can show "waiting" in the feed.
   */
  private addToQueue(walletAddress: string, txSignature: string, tokenAmount: number): void {
    // Avoid duplicate queue entries
    if (this.waitingQueue.find((p) => p.walletAddress === walletAddress)) return;

    this.waitingQueue.push({ walletAddress, txSignature, tokenAmount, queuedAt: new Date() });
    const position = this.waitingQueue.length;

    logger.info(`⏳ Queued for next round: ${walletAddress.slice(0, 8)}... (queue position #${position})`);

    if (this.io) {
      this.io.emit('participant-queued', {
        walletAddress,
        walletShort: this.truncateAddress(walletAddress),
        position,
        queueLength: this.waitingQueue.length,
      });
    }
  }

  /**
   * Remove a player from both the active round AND the waiting queue (token sold).
   */
  async removeParticipant(walletAddress: string): Promise<void> {
    try {
      // Remove from queue first (if present)
      const queueIdx = this.waitingQueue.findIndex((p) => p.walletAddress === walletAddress);
      if (queueIdx !== -1) {
        this.waitingQueue.splice(queueIdx, 1);
        logger.info(`🗑  Removed from queue: ${walletAddress.slice(0, 8)}...`);
      }

      const currentRound = timerService.getCurrentRound();
      const battle = await prisma.battle.findUnique({ where: { roundId: currentRound } });
      if (!battle) return;

      const deleted = await prisma.participant.deleteMany({
        where: { battleId: battle.id, walletAddress },
      });

      if (deleted.count > 0) {
        await prisma.battle.update({
          where: { id: battle.id },
          data: { participantCount: { decrement: deleted.count } },
        });

        logger.warn(`❌ Removed participant: ${walletAddress.slice(0, 8)}... (Token sold)`);

        if (this.io) {
          this.io.emit('participant-removed', { walletAddress, reason: 'token_sold' });
        }
      }
    } catch (error: any) {
      logger.error('Error removing participant:', error);
    }
  }

  /**
   * Populate the next round with up to MAX_FIGHTERS players from the waiting queue.
   * Called by battle-engine.ts after advanceToNextRound().
   */
  async populateNextRound(roundId: number): Promise<void> {
    if (this.waitingQueue.length === 0) return;

    const batch = this.waitingQueue.splice(0, MAX_FIGHTERS);
    logger.info(`📋 Populating round ${roundId} from queue — ${batch.length} players (${this.waitingQueue.length} still waiting)`);

    for (const player of batch) {
      try {
        await this.recordParticipation(
          player.walletAddress,
          player.txSignature,
          player.tokenAmount,
          roundId,
          true, // fromQueue — skip per-player forceEnd
        );
      } catch {
        // Don't let one failure block the rest
      }
    }

    // If all MAX_FIGHTERS slots filled from queue, trigger battle immediately
    if (timerService.isActive() && timerService.getTimerState().participantCount >= MAX_FIGHTERS) {
      logger.info(`⚡ Queue batch filled all ${MAX_FIGHTERS} slots — force-starting round ${roundId} now!`);
      timerService.forceEnd();
    }
  }

  /** Number of players currently in the waiting queue */
  public getQueueCount(): number {
    return this.waitingQueue.length;
  }

  /** Clear the entire queue (called on tournament reset) */
  public clearQueue(): void {
    this.waitingQueue = [];
    logger.info('🗑  Waiting queue cleared');
  }

  /** Get participants for a round */
  async getParticipants(roundId: number) {
    const battle = await prisma.battle.findUnique({
      where: { roundId },
      include: { participants: true },
    });
    return battle?.participants || [];
  }

  /** Get or create battle record for a given round */
  private async getOrCreateBattle(roundId: number) {
    let battle = await prisma.battle.findUnique({ where: { roundId } });
    if (!battle) {
      battle = await prisma.battle.create({
        data: { roundId, status: 'TIMER_ACTIVE', startedAt: new Date() },
      });
      logger.info(`Created battle for round ${roundId}`);
    }
    return battle;
  }

  private truncateAddress(address: string): string {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  async hasJoined(walletAddress: string, roundId: number): Promise<boolean> {
    const battle = await prisma.battle.findUnique({ where: { roundId } });
    if (!battle) return false;
    const participant = await prisma.participant.findUnique({
      where: { battleId_walletAddress: { battleId: battle.id, walletAddress } },
    });
    return !!participant;
  }
}

export const battleEntryService = new BattleEntryService();
export default battleEntryService;
