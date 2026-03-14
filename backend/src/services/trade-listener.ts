/**
 * trade-listener.ts
 *
 * Connects directly to Solana (via Helius free RPC WebSocket) and streams
 * every on-chain transaction that involves your token mint in real time.
 *
 * No webhook server exposure needed — the backend itself subscribes.
 *
 * Flow:
 *  1. connection.onLogs(tokenMint, cb)  → fires for every tx touching the mint
 *  2. Skip failed / non-pump.fun txs
 *  3. Fetch full parsed transaction  → getParsedTransaction()
 *  4. Diff pre/post token balances   → detect BUY (delta > 0) or SELL (delta < 0)
 *  5. Route to livePurchaseService.handlePurchase / handleSell
 */

import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import logger from '../config/logger';
import livePurchaseService from './live-purchases';

// pump.fun program IDs (both the original and migration program)
const PUMP_FUN_PROGRAMS = new Set([
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',  // pump.fun AMM
  'BSfD6SHZigAfDWSjzD5Q41jw8LmKwtmjskPH9XW1mrRW', // pump.fun fee collector
]);

// How long to wait before re-fetching a tx that isn't confirmed yet (ms)
const FETCH_RETRY_DELAY_MS  = 1500;
const FETCH_MAX_RETRIES     = 5;

class TradeListener {
  private connection: Connection | null = null;
  private subscriptionId: number | null = null;
  private isRunning = false;
  private tokenMint: string | null = null;

  // ─── Public API ───────────────────────────────────────────────────────────

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

    // Use Shyft WebSocket for subscriptions (free, low-latency)
    // Use Helius HTTP RPC for fetching full parsed transactions
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

  // ─── Subscription ─────────────────────────────────────────────────────────

  private subscribe(): void {
    if (!this.connection || !this.tokenMint) return;

    // onLogs accepts a PublicKey — it automatically subscribes to all txs
    // where this account appears (covers every pump.fun buy/sell of the mint)
    const mintPubkey = new PublicKey(this.tokenMint);

    this.subscriptionId = this.connection.onLogs(
      mintPubkey,
      async ({ signature, logs, err }) => {
        // Skip failed transactions
        if (err) return;

        // Only process pump.fun swaps — check program logs quickly before
        // making an expensive getParsedTransaction call
        const isPumpFunSwap = logs.some(
          (line) =>
            PUMP_FUN_PROGRAMS.has(line.replace('Program ', '').split(' ')[0]) ||
            line.includes('Instruction: Buy') ||
            line.includes('Instruction: Sell') ||
            line.includes('Instruction: buy') ||
            line.includes('Instruction: sell'),
        );

        if (!isPumpFunSwap) return;

        logger.info(`[TradeListener] Swap detected → TX ${signature.slice(0, 12)}...`);

        const tx = await this.fetchWithRetry(signature);
        if (!tx) {
          logger.warn(`[TradeListener] Could not fetch TX ${signature.slice(0, 12)} after retries`);
          return;
        }

        await this.parseTrade(signature, tx);
      },
      'confirmed',
    );

    logger.info(`[TradeListener] ✅ Listening for trades on mint: ${this.tokenMint}`);
  }

  // ─── Transaction fetch with retry ─────────────────────────────────────────

  private async fetchWithRetry(
    signature: string,
    retries = FETCH_MAX_RETRIES,
  ): Promise<ParsedTransactionWithMeta | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const tx = await this.connection!.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });
        if (tx) return tx;
      } catch (err: any) {
        logger.debug(`[TradeListener] Fetch attempt ${attempt} failed for ${signature.slice(0,12)}: ${err.message}`);
      }

      if (attempt < retries) {
        await sleep(FETCH_RETRY_DELAY_MS);
      }
    }
    return null;
  }

  // ─── Trade parser ─────────────────────────────────────────────────────────

  private async parseTrade(
    signature: string,
    tx: ParsedTransactionWithMeta,
  ): Promise<void> {
    const tokenMint = this.tokenMint!;

    const blockTime = tx.blockTime ?? Math.floor(Date.now() / 1000);
    const timestamp = new Date(blockTime * 1000);

    const preBalances  = tx.meta?.preTokenBalances  ?? [];
    const postBalances = tx.meta?.postTokenBalances ?? [];

    // Build a map of pre-balances keyed by owner+mint
    const preMap = new Map<string, number>();
    for (const b of preBalances) {
      if (b.mint === tokenMint && b.owner) {
        preMap.set(b.owner, b.uiTokenAmount.uiAmount ?? 0);
      }
    }

    // Walk through post-balances and diff
    for (const post of postBalances) {
      if (post.mint !== tokenMint || !post.owner) continue;

      const pre   = preMap.get(post.owner) ?? 0;
      const after = post.uiTokenAmount.uiAmount ?? 0;
      const delta = after - pre;

      if (Math.abs(delta) < 0.000001) continue; // ignore dust / rounding

      const walletAddress = post.owner;
      const tokenAmount   = Math.abs(delta);

      // De-duplicate — skip if we already processed this exact signature
      const alreadyProcessed = await livePurchaseService.isTransactionProcessed(signature);
      if (alreadyProcessed) {
        logger.debug(`[TradeListener] TX ${signature.slice(0, 12)} already processed, skipping`);
        return;
      }

      if (delta > 0) {
        // ── BUY ──────────────────────────────────────────────────────────
        logger.info(
          `[TradeListener] 🟢 BUY  | ${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)} | +${tokenAmount.toLocaleString()} tokens`,
        );

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
        // ── SELL ─────────────────────────────────────────────────────────
        logger.info(
          `[TradeListener] 🔴 SELL | ${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)} | -${tokenAmount.toLocaleString()} tokens`,
        );

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
