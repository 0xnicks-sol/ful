/**
 * trade-listener.ts
 *
 * Two-phase real-time trade detection:
 *
 * Phase 1 (instant, <100ms):
 *   onLogs fires → immediately fetch raw (non-parsed) tx → extract signer →
 *   emit live-purchase / participant-removed to frontend RIGHT AWAY.
 *
 * Phase 2 (background, 0-3s):
 *   Fetch full getParsedTransaction to get exact token balances →
 *   call handlePurchase / handleSell for DB write + battle entry.
 *
 * This means fighters appear on screen in <100ms from on-chain confirmation.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import logger from '../config/logger';
import livePurchaseService from './live-purchases';

// pump.fun program IDs
const PUMP_FUN_PROGRAMS = new Set([
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  'BSfD6SHZigAfDWSjzD5Q41jw8LmKwtmjskPH9XW1mrRW',
]);

// Phase-2 retry config — lower than before to keep things snappy
const FETCH_RETRY_DELAY_MS = 500;
const FETCH_MAX_RETRIES    = 4;

class TradeListener {
  private connection: Connection | null = null;
  private subscriptionId: number | null = null;
  private isRunning  = false;
  private tokenMint: string | null = null;

  // ─── Public API ─────────────────────────────────────────────────────────────

  start(): void {
    const rpcUrl   = process.env.SOLANA_RPC_URL;
    const wsUrl    = process.env.SOLANA_WS_URL;
    const mintAddr = process.env.SPL_TOKEN_MINT;

    if (!rpcUrl) {
      logger.error('[TradeListener] SOLANA_RPC_URL not set — cannot start');
      return;
    }
    if (!mintAddr) {
      logger.error('[TradeListener] SPL_TOKEN_MINT not set — cannot start');
      return;
    }
    if (this.isRunning) {
      logger.warn('[TradeListener] Already running');
      return;
    }

    this.tokenMint = mintAddr;
    this.isRunning = true;

    const wsEndpoint = wsUrl ||
      rpcUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');

    this.connection = new Connection(rpcUrl, {
      wsEndpoint,
      commitment: 'confirmed',
    });

    logger.info(`[TradeListener] HTTP RPC : ${rpcUrl.slice(0, 55)}...`);
    logger.info(`[TradeListener] WS       : ${wsEndpoint.slice(0, 55)}...`);

    this.subscribe();
  }

  stop(): void {
    this.isRunning = false;
    if (this.connection && this.subscriptionId !== null) {
      this.connection.removeOnLogsListener(this.subscriptionId).catch(() => {});
      this.subscriptionId = null;
    }
    logger.info('[TradeListener] Stopped');
  }

  // ─── Subscription ───────────────────────────────────────────────────────────

  private subscribe(): void {
    if (!this.connection || !this.tokenMint) return;

    const mintPubkey = new PublicKey(this.tokenMint);

    this.subscriptionId = this.connection.onLogs(
      mintPubkey,
      async ({ signature, logs, err }) => {
        if (err) return;

        const isPumpFunSwap = logs.some(
          (line) =>
            PUMP_FUN_PROGRAMS.has(line.replace('Program ', '').split(' ')[0]) ||
            line.includes('Instruction: Buy')  ||
            line.includes('Instruction: Sell') ||
            line.includes('Instruction: buy')  ||
            line.includes('Instruction: sell'),
        );
        if (!isPumpFunSwap) return;

        const isBuy = logs.some(
          (l) => l.includes('Instruction: Buy') || l.includes('Instruction: buy'),
        );

        logger.info(
          `[TradeListener] ${isBuy ? '🟢 BUY' : '🔴 SELL'} detected → TX ${signature.slice(0, 12)}...`,
        );

        // ── Phase 1: instant signer extraction ──────────────────────────────
        // getTransaction (raw) is faster than getParsedTransaction —
        // fire-and-forget, do NOT await here so Phase 2 starts in parallel.
        this.extractSignerAndEmitInstant(signature, isBuy).catch(() => {});

        // ── Phase 2: background full parse ───────────────────────────────────
        // This runs in parallel with Phase 1. Once we have the parsed tx we
        // call handlePurchase / handleSell for the real token amount + DB write.
        this.fetchWithRetry(signature)
          .then((tx) => {
            if (tx) return this.parseTrade(signature, tx);
            return undefined;
          })
          .catch((err: any) =>
            logger.warn(`[TradeListener] Phase-2 parse failed for ${signature.slice(0, 12)}: ${err.message}`),
          );
      },
      'confirmed',
    );

    logger.info(`[TradeListener] ✅ Listening for trades on mint: ${this.tokenMint}`);
  }

  // ─── Phase 1: Instant emit via raw (non-parsed) transaction ─────────────────

  private async extractSignerAndEmitInstant(
    signature: string,
    isBuy: boolean,
  ): Promise<void> {
    try {
      // Raw getTransaction is lighter and usually returns before getParsedTransaction
      const raw = await this.connection!.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });

      if (!raw || raw.meta?.err) return;

      // First account key = fee payer = the trader
      const keys   = raw.transaction.message.getAccountKeys();
      const signer = keys.get(0)?.toBase58();
      if (!signer) return;

      if (isBuy) {
        livePurchaseService.emitInstantBuy(signer);
      } else {
        livePurchaseService.emitInstantSell(signer);
      }
    } catch (err: any) {
      logger.debug(`[TradeListener] Phase-1 signer extraction failed: ${err.message}`);
    }
  }

  // ─── Phase 2: Full parsed transaction fetch ──────────────────────────────────

  private async fetchWithRetry(
    signature: string,
    retries = FETCH_MAX_RETRIES,
  ): Promise<import('@solana/web3.js').ParsedTransactionWithMeta | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const tx = await this.connection!.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });
        if (tx) return tx;
      } catch (err: any) {
        logger.debug(
          `[TradeListener] Fetch attempt ${attempt} failed for ${signature.slice(0, 12)}: ${err.message}`,
        );
      }
      if (attempt < retries) await sleep(FETCH_RETRY_DELAY_MS);
    }
    logger.warn(`[TradeListener] Could not fetch TX ${signature.slice(0, 12)} after ${retries} retries`);
    return null;
  }

  // ─── Phase 2: Trade parser ───────────────────────────────────────────────────

  private async parseTrade(
    signature: string,
    tx: import('@solana/web3.js').ParsedTransactionWithMeta,
  ): Promise<void> {
    const tokenMint = this.tokenMint!;

    const blockTime = tx.blockTime ?? Math.floor(Date.now() / 1000);
    const timestamp = new Date(blockTime * 1000);

    const preBalances  = tx.meta?.preTokenBalances  ?? [];
    const postBalances = tx.meta?.postTokenBalances ?? [];

    const preMap = new Map<string, number>();
    for (const b of preBalances) {
      if (b.mint === tokenMint && b.owner) {
        preMap.set(b.owner, b.uiTokenAmount.uiAmount ?? 0);
      }
    }

    for (const post of postBalances) {
      if (post.mint !== tokenMint || !post.owner) continue;

      const pre   = preMap.get(post.owner) ?? 0;
      const after = post.uiTokenAmount.uiAmount ?? 0;
      const delta = after - pre;

      if (Math.abs(delta) < 0.000001) continue;

      const walletAddress = post.owner;
      const tokenAmount   = Math.abs(delta);

      // Skip already-processed signatures
      const alreadyProcessed = await livePurchaseService.isTransactionProcessed(signature);
      if (alreadyProcessed) {
        logger.debug(`[TradeListener] TX ${signature.slice(0, 12)} already processed, skipping`);
        return;
      }

      if (delta > 0) {
        try {
          await livePurchaseService.handlePurchase({
            walletAddress,
            txSignature: signature,
            tokenAmount,
            timestamp,
          });
        } catch (err: any) {
          logger.error(`[TradeListener] handlePurchase error: ${err.message}`);
        }
      } else {
        try {
          await livePurchaseService.handleSell({
            walletAddress,
            txSignature: signature,
            tokenAmount,
            timestamp,
          });
        } catch (err: any) {
          logger.error(`[TradeListener] handleSell error: ${err.message}`);
        }
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default new TradeListener();
