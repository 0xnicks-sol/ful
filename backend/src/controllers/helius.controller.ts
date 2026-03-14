/**
 * helius.controller.ts
 *
 * Handles the webhook that Helius fires every time someone buys or sells
 * your pump.fun token on-chain.
 *
 * HOW TO SET UP HELIUS WEBHOOK
 * ──────────────────────────────────────────────────────────────────────────
 *  1. Go to https://dev.helius.xyz  →  Webhooks  →  New Webhook
 *  2. Webhook URL:  https://your-backend.railway.app/api/webhooks/helius
 *  3. Transaction Types: SWAP   (catches pump.fun buys AND sells)
 *  4. Account Addresses: paste your SPL_TOKEN_MINT address
 *  5. Auth Header:  x-helius-signature  (copy the secret → HELIUS_WEBHOOK_SECRET in .env)
 *
 * PAYLOAD SHAPE (Helius Enhanced Transactions)
 * ──────────────────────────────────────────────────────────────────────────
 *  Helius sends an ARRAY of transaction objects.  Each object has:
 *
 *  {
 *    type:           "SWAP"
 *    source:         "PUMP_FUN" | "RAYDIUM" | ...
 *    signature:      "<tx signature>"        // unique per tx
 *    feePayer:       "<buyer/seller wallet>"
 *    timestamp:      1234567890              // unix seconds
 *    tokenTransfers: [
 *      {
 *        mint:            "<your token mint>",
 *        tokenAmount:     1000000,           // raw amount (divide by 10^decimals)
 *        decimals:        6,
 *        fromUserAccount: "<seller wallet>", // empty string on buys
 *        toUserAccount:   "<buyer wallet>",  // empty string on sells
 *      }
 *    ]
 *    transactionError: null | { ... }
 *  }
 *
 *  BUY  → tokenTransfer.toUserAccount   = buyer wallet  (fromUserAccount = "")
 *  SELL → tokenTransfer.fromUserAccount = seller wallet (toUserAccount   = "")
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../config/logger';
import livePurchaseService from '../services/live-purchases';

// ─── Helius payload types ─────────────────────────────────────────────────────

interface HeliusTokenTransfer {
  mint:            string;
  tokenAmount:     number;
  decimals:        number;
  fromUserAccount: string;
  toUserAccount:   string;
  fromTokenAccount?: string;
  toTokenAccount?:   string;
  tokenStandard?:    string;
}

interface HeliusTransaction {
  signature:        string;
  type:             string;      // "SWAP", "TRANSFER", etc.
  source:           string;      // "PUMP_FUN", "RAYDIUM", etc.
  feePayer:         string;      // the wallet that paid the fee (= buyer/seller)
  timestamp:        number;      // unix seconds
  tokenTransfers:   HeliusTokenTransfer[];
  transactionError: null | object;
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifyHeliusSignature(req: Request): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured → allow all (dev mode only)
    logger.warn('HELIUS_WEBHOOK_SECRET not set — skipping signature check');
    return true;
  }

  const receivedSig = req.headers['x-helius-signature'] as string | undefined;
  if (!receivedSig) return false;

  // Helius signs the raw body with HMAC-SHA256
  const rawBody   = JSON.stringify(req.body);
  const expected  = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(receivedSig),
    Buffer.from(expected),
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/helius
 *
 * Entry point for all pump.fun buy/sell events.
 * Helius sends an array — we iterate and process each one.
 */
export async function handleHeliusWebhook(req: Request, res: Response): Promise<void> {
  // 1. Verify the request is genuinely from Helius
  if (!verifyHeliusSignature(req)) {
    logger.warn('Helius webhook: invalid signature — rejected');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const transactions: HeliusTransaction[] = Array.isArray(req.body)
    ? req.body
    : [req.body];

  if (transactions.length === 0) {
    res.status(200).json({ processed: 0 });
    return;
  }

  const tokenMint = process.env.SPL_TOKEN_MINT;
  if (!tokenMint) {
    logger.error('SPL_TOKEN_MINT not set in .env — cannot process Helius events');
    res.status(500).json({ error: 'SPL_TOKEN_MINT not configured' });
    return;
  }

  let processed = 0;

  for (const tx of transactions) {
    // Skip failed transactions
    if (tx.transactionError !== null) continue;

    // Find a transfer involving our token mint
    const transfer = tx.tokenTransfers?.find((t) => t.mint === tokenMint);
    if (!transfer) continue;

    const txSignature  = tx.signature;
    const timestamp    = new Date(tx.timestamp * 1000);
    const tokenAmount  = transfer.tokenAmount / Math.pow(10, transfer.decimals);

    const isBuy  = transfer.toUserAccount   !== '' && transfer.fromUserAccount === '';
    const isSell = transfer.fromUserAccount !== '' && transfer.toUserAccount   === '';

    if (isBuy) {
      // ── Token Purchase ─────────────────────────────────────────────────
      const walletAddress = transfer.toUserAccount;
      logger.info(`[Helius] BUY  ${walletAddress.slice(0, 8)}... | ${tokenAmount.toFixed(2)} tokens | TX: ${txSignature.slice(0, 12)}...`);

      try {
        // Idempotent — skips if already processed
        const alreadyDone = await livePurchaseService.isTransactionProcessed(txSignature);
        if (!alreadyDone) {
          await livePurchaseService.handlePurchase({
            walletAddress,
            txSignature,
            tokenAmount,
            timestamp,
          });
        }
        processed++;
      } catch (err: any) {
        logger.error(`[Helius] Error processing buy ${txSignature}:`, err.message);
      }
    } else if (isSell) {
      // ── Token Sell ─────────────────────────────────────────────────────
      const walletAddress = transfer.fromUserAccount;
      logger.warn(`[Helius] SELL ${walletAddress.slice(0, 8)}... | ${tokenAmount.toFixed(2)} tokens | TX: ${txSignature.slice(0, 12)}...`);

      try {
        const alreadyDone = await livePurchaseService.isTransactionProcessed(txSignature);
        if (!alreadyDone) {
          await livePurchaseService.handleSell({
            walletAddress,
            txSignature,
            tokenAmount,
            timestamp,
          });
        }
        processed++;
      } catch (err: any) {
        logger.error(`[Helius] Error processing sell ${txSignature}:`, err.message);
      }
    }
    // Any other transfer type (e.g. wallet-to-wallet) is silently ignored
  }

  res.status(200).json({ processed });
}
