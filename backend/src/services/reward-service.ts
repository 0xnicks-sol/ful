/**
 * reward-service.ts  (no smart contract required)
 *
 * Distributes SOL prizes directly from the backend prize-pool wallet
 * using standard @solana/web3.js SystemProgram.transfer calls.
 *
 * NO custom Anchor program needed.
 * The token itself lives on pump.fun — we just need a funded backend wallet.
 *
 * PRIZE POOL MODEL
 * ─────────────────────────────────────────────────────────────────────────
 *  • Admin pre-loads the PRIZE_POOL_WALLET with SOL before the tournament.
 *  • After all 10 rounds the backend sends SOL directly:
 *      1st place  →  50% of pool
 *      2nd place  →  30% of pool
 *      3rd place  →  20% of pool
 *  • Every TX is verifiable on Solana Explorer.
 * ─────────────────────────────────────────────────────────────────────────
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Server as SocketIOServer } from 'socket.io';
import prisma from '../config/database';
import logger from '../config/logger';

export interface DistributionResult {
  success: boolean;
  transactions?: {
    first:  { address: string; amountSOL: number; txSignature: string };
    second: { address: string; amountSOL: number; txSignature: string };
    third:  { address: string; amountSOL: number; txSignature: string };
  };
  error?: string;
}

class RewardService {
  private io: SocketIOServer | null = null;
  private connection: Connection;
  private prizeWallet: Keypair | null = null;

  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed',
    );
    this.loadPrizeWallet();
  }

  public initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('RewardService initialized (no-contract / direct-SOL mode)');
  }

  // ─── Wallet Loading ──────────────────────────────────────────────────────

  private loadPrizeWallet(): void {
    try {
      const raw = process.env.PRIZE_WALLET_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
      if (!raw || raw === 'test_key') {
        logger.warn('⚠️  PRIZE_WALLET_PRIVATE_KEY not set — rewards will run in mock mode');
        return;
      }
      // bs58 is a transitive dep of @solana/web3.js — always available
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const bs58 = require('bs58') as { decode: (s: string) => Uint8Array };
      this.prizeWallet = Keypair.fromSecretKey(bs58.decode(raw));
      logger.info(`🏦 Prize wallet: ${this.prizeWallet.publicKey.toBase58()}`);
    } catch (err: any) {
      logger.error('Failed to load prize wallet:', err.message);
    }
  }

  // ─── Balance Check ───────────────────────────────────────────────────────

  async getPoolBalance(): Promise<number> {
    if (!this.prizeWallet) return 0;
    try {
      const lamports = await this.connection.getBalance(this.prizeWallet.publicKey);
      return lamports / LAMPORTS_PER_SOL;
    } catch {
      return 0;
    }
  }

  // ─── Reward Distribution ─────────────────────────────────────────────────

  /**
   * distributeRewards
   *
   * Sends SOL directly from the prize wallet to the top 3 leaderboard wallets.
   * Uses 3 separate transactions so each transfer has its own verifiable TX ID.
   *
   * Split:  1st → 50%,  2nd → 30%,  3rd → 20%
   */
  async distributeRewards(top3Addresses: string[]): Promise<DistributionResult> {
    // ── Mock mode ──────────────────────────────────────────────────────────
    if (!this.prizeWallet) {
      return this.mockDistribution(top3Addresses);
    }

    if (top3Addresses.length < 3) {
      return { success: false, error: `Need 3 winners, got ${top3Addresses.length}` };
    }

    // ── Check pool balance ─────────────────────────────────────────────────
    const balanceLamports = await this.connection.getBalance(
      this.prizeWallet.publicKey,
    );
    // Keep 0.01 SOL for TX fees
    const feePad      = 0.01 * LAMPORTS_PER_SOL;
    const distributable = balanceLamports - feePad;

    if (distributable <= 0) {
      const msg = `Prize wallet has insufficient SOL (balance: ${balanceLamports / LAMPORTS_PER_SOL} SOL)`;
      logger.error(msg);
      return { success: false, error: msg };
    }

    const first  = Math.floor(distributable * 0.50);
    const second = Math.floor(distributable * 0.30);
    const third  = distributable - first - second; // 20% + any rounding remainder

    logger.info(`💰 Distributing ${(distributable / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    logger.info(`   1st (50%): ${(first  / LAMPORTS_PER_SOL).toFixed(4)} SOL → ${top3Addresses[0]}`);
    logger.info(`   2nd (30%): ${(second / LAMPORTS_PER_SOL).toFixed(4)} SOL → ${top3Addresses[1]}`);
    logger.info(`   3rd (20%): ${(third  / LAMPORTS_PER_SOL).toFixed(4)} SOL → ${top3Addresses[2]}`);

    try {
      // Send 3 separate transactions (each independently verifiable)
      const tx1 = await this.sendSOL(top3Addresses[0], first);
      const tx2 = await this.sendSOL(top3Addresses[1], second);
      const tx3 = await this.sendSOL(top3Addresses[2], third);

      // Log to DB for audit trail
      await prisma.reward.create({
        data: {
          txSignature:     tx1,          // primary TX ID
          winners:         top3Addresses,
          amountPerWinner: (distributable / LAMPORTS_PER_SOL / 3).toFixed(4),
          distributedAt:   new Date(),
        },
      });

      const result: DistributionResult = {
        success: true,
        transactions: {
          first:  { address: top3Addresses[0], amountSOL: first  / LAMPORTS_PER_SOL, txSignature: tx1 },
          second: { address: top3Addresses[1], amountSOL: second / LAMPORTS_PER_SOL, txSignature: tx2 },
          third:  { address: top3Addresses[2], amountSOL: third  / LAMPORTS_PER_SOL, txSignature: tx3 },
        },
      };

      // Broadcast to all connected clients
      if (this.io) {
        this.io.emit('rewards-distributed', {
          winners: top3Addresses,
          transactions: result.transactions,
          explorerBase: `https://explorer.solana.com/tx/`,
          cluster: process.env.SOLANA_NETWORK === 'mainnet-beta' ? '' : '?cluster=devnet',
          isMock: false,
        });
      }

      logger.info(`✅ All rewards sent!`);
      logger.info(`   TX1: https://explorer.solana.com/tx/${tx1}?cluster=devnet`);
      logger.info(`   TX2: https://explorer.solana.com/tx/${tx2}?cluster=devnet`);
      logger.info(`   TX3: https://explorer.solana.com/tx/${tx3}?cluster=devnet`);

      return result;
    } catch (err: any) {
      logger.error('Error sending rewards:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Send `lamports` from the prize wallet to `toAddress`.
   * Returns the transaction signature.
   */
  private async sendSOL(toAddress: string, lamports: number): Promise<string> {
    if (!this.prizeWallet) throw new Error('Prize wallet not loaded');

    const toPubkey = new PublicKey(toAddress);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.prizeWallet.publicKey,
        toPubkey,
        lamports,
      }),
    );

    const sig = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.prizeWallet],
      { commitment: 'confirmed' },
    );

    return sig;
  }

  // ─── Mock Distribution ───────────────────────────────────────────────────

  private async mockDistribution(
    top3Addresses: string[],
  ): Promise<DistributionResult> {
    logger.warn('🧪 MOCK reward distribution (PRIZE_WALLET_PRIVATE_KEY not set)');
    logger.info(`   1st (50%): ${top3Addresses[0] || 'N/A'}`);
    logger.info(`   2nd (30%): ${top3Addresses[1] || 'N/A'}`);
    logger.info(`   3rd (20%): ${top3Addresses[2] || 'N/A'}`);
    logger.warn('   → Fund the prize wallet and set PRIZE_WALLET_PRIVATE_KEY to go live');

    if (this.io) {
      this.io.emit('rewards-distributed', {
        winners: top3Addresses,
        transactions: null,
        isMock: true,
      });
    }

    return { success: true };
  }
}

export const rewardService = new RewardService();
export default rewardService;
