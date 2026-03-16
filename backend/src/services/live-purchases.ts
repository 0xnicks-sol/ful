import { Server as SocketIOServer } from 'socket.io';
import prisma from '../config/database';
import logger from '../config/logger';
import battleEntryService from './battle-entry';
import timerService from './timer-service';

export interface TokenPurchaseData {
  walletAddress: string;
  txSignature: string;
  tokenAmount: number;
  timestamp: Date;
}

export interface TokenSellData {
  walletAddress: string;
  txSignature: string;
  tokenAmount: number;
  timestamp: Date;
}

class LivePurchaseService {
  private io: SocketIOServer | null = null;

  public initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('LivePurchaseService initialized');
  }

  /**
   * Phase-1 instant emit: called by trade-listener immediately after
   * getting the signer from the raw (non-parsed) transaction.
   * No DB write, no verification — just push the socket event NOW.
   */
  public emitInstantBuy(walletAddress: string): void {
    if (!this.io) return;
    const state   = timerService.getTimerState();
    const canJoin = !timerService.isFightInProgress() &&
      (timerService.isActive() || state.status === 'idle');

    this.io.emit('live-purchase', {
      buyer:      walletAddress,
      buyerShort: this.truncateAddress(walletAddress),
      amount:     0,          // real amount arrives with participant-joined
      timestamp:  new Date(),
      canJoin,
      optimistic: true,
    });

    logger.info(`⚡ Instant emit live-purchase → ${walletAddress.slice(0, 8)}...`);
  }

  /**
   * Phase-1 instant emit for sells: removes fighter from arena immediately.
   */
  public emitInstantSell(walletAddress: string): void {
    if (!this.io) return;
    this.io.emit('participant-removed', {
      walletAddress,
      reason: 'token_sold',
    });
    logger.info(`⚡ Instant emit participant-removed → ${walletAddress.slice(0, 8)}...`);
  }

  /**
   * Phase-2 full purchase handler: called after getParsedTransaction succeeds.
   * Emits confirmed live-purchase (with real token amount) + records in DB + joins battle.
   */
  async handlePurchase(data: TokenPurchaseData): Promise<void> {
    try {
      logger.info(`📥 Purchase confirmed: ${data.walletAddress} | ${data.tokenAmount} tokens`);

      // ── 1. Emit confirmed socket event (full wallet + real amount) ──────────
      const state   = timerService.getTimerState();
      const canJoin = !timerService.isFightInProgress() &&
        (timerService.isActive() || state.status === 'idle');

      if (this.io) {
        this.io.emit('live-purchase', {
          buyer:      data.walletAddress,
          buyerShort: this.truncateAddress(data.walletAddress),
          amount:     data.tokenAmount,
          timestamp:  data.timestamp,
          canJoin,
          optimistic: false,
        });
      }

      // ── 2. DB write in background (never block the socket path) ─────────────
      prisma.tokenTransaction.create({
        data: {
          walletAddress: data.walletAddress,
          txSignature:   data.txSignature,
          type:          'PURCHASE',
          tokenAmount:   data.tokenAmount,
          timestamp:     data.timestamp,
          processed:     true,
        },
      }).catch((err: any) =>
        logger.warn(`[DB] tokenTransaction create failed: ${err.message}`)
      );

      // ── 3. Record battle participation ──────────────────────────────────────
      const currentRound = timerService.getCurrentRound();
      const joined = await battleEntryService.recordParticipation(
        data.walletAddress,
        data.txSignature,
        data.tokenAmount,
        currentRound,
      );

      if (joined) {
        logger.info(`✅ Auto-joined battle: ${data.walletAddress}`);
      }
    } catch (error: any) {
      logger.error('Error handling purchase:', error);
    }
  }

  /**
   * Phase-2 full sell handler: called after getParsedTransaction succeeds.
   * Instant socket emit already fired by emitInstantSell — this just does cleanup.
   */
  async handleSell(data: TokenSellData): Promise<void> {
    try {
      logger.warn(`📤 Sell confirmed: ${data.walletAddress}`);

      // ── 1. Emit participant-removed again (idempotent on frontend) ───────────
      if (this.io) {
        this.io.emit('participant-removed', {
          walletAddress: data.walletAddress,
          reason: 'token_sold',
        });
      }

      // ── 2. Remove from active battle ─────────────────────────────────────────
      battleEntryService.removeParticipant(data.walletAddress).catch(() => {});

      // ── 3. Background DB writes ───────────────────────────────────────────────
      prisma.tokenTransaction.create({
        data: {
          walletAddress: data.walletAddress,
          txSignature:   data.txSignature,
          type:          'SELL',
          tokenAmount:   data.tokenAmount,
          timestamp:     data.timestamp,
          processed:     true,
        },
      }).catch((err: any) =>
        logger.warn(`[DB] tokenTransaction create failed: ${err.message}`)
      );

      prisma.character.updateMany({
        where: { walletAddress: data.walletAddress, isActive: true },
        data:  { destroyedAt: new Date(), isActive: false },
      }).catch(() => {});

    } catch (error: any) {
      logger.error('Error handling sell:', error);
    }
  }

  private truncateAddress(address: string): string {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  async isTransactionProcessed(txSignature: string): Promise<boolean> {
    const existing = await prisma.tokenTransaction.findUnique({
      where: { txSignature },
    });
    return !!existing;
  }
}

export const livePurchaseService = new LivePurchaseService();
export default livePurchaseService;
