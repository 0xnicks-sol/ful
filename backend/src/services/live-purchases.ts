import { Connection } from '@solana/web3.js';
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
  private connection: Connection;

  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
  }

  /**
   * Initialize with Socket.IO instance
   */
  public initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('LivePurchaseService initialized');
  }

  /**
   * Handle token purchase webhook
   */
  async handlePurchase(data: TokenPurchaseData): Promise<void> {
    try {
      logger.info(`📥 Token purchase received: ${data.walletAddress}`);

      // Verify transaction on Solana blockchain
      const isValid = await this.verifyPurchaseTransaction(
        data.txSignature,
        data.walletAddress
      );

      if (!isValid) {
        logger.error(`Invalid purchase transaction: ${data.txSignature}`);
        return;
      }

      // Log transaction
      await prisma.tokenTransaction.create({
        data: {
          walletAddress: data.walletAddress,
          txSignature: data.txSignature,
          type: 'PURCHASE',
          tokenAmount: data.tokenAmount,
          timestamp: data.timestamp,
          processed: true,
        },
      });

      // Broadcast live purchase to all clients
      if (this.io) {
        this.io.emit('live-purchase', {
          buyer: this.truncateAddress(data.walletAddress),
          amount: data.tokenAmount,
          timestamp: data.timestamp,
        });
      }

      // Auto-join battle if timer is active
      if (timerService.isActive()) {
        const currentRound = timerService.getCurrentRound();
        const joined = await battleEntryService.recordParticipation(
          data.walletAddress,
          data.txSignature,
          data.tokenAmount,
          currentRound
        );

        if (joined) {
          logger.info(`✅ Auto-joined battle: ${data.walletAddress}`);
        }
      } else {
        logger.info(`⏸️  Purchase recorded but battle window closed`);
      }
    } catch (error: any) {
      logger.error('Error handling purchase:', error);
      throw error;
    }
  }

  /**
   * Handle token sell webhook
   */
  async handleSell(data: TokenSellData): Promise<void> {
    try {
      logger.warn(`📤 Token sell detected: ${data.walletAddress}`);

      // Verify sell transaction on Solana
      const isValid = await this.verifySellTransaction(
        data.txSignature,
        data.walletAddress
      );

      if (!isValid) {
        logger.error(`Invalid sell transaction: ${data.txSignature}`);
        return;
      }

      // Log transaction
      await prisma.tokenTransaction.create({
        data: {
          walletAddress: data.walletAddress,
          txSignature: data.txSignature,
          type: 'SELL',
          tokenAmount: data.tokenAmount,
          timestamp: data.timestamp,
          processed: true,
        },
      });

      // Find all active characters owned by wallet
      const characters = await prisma.character.findMany({
        where: {
          walletAddress: data.walletAddress,
          isActive: true,
        },
      });

      if (characters.length > 0) {
        // Destroy all characters
        await prisma.character.updateMany({
          where: {
            walletAddress: data.walletAddress,
            isActive: true,
          },
          data: {
            destroyedAt: new Date(),
            isActive: false,
          },
        });

        logger.warn(`🔥 Destroyed ${characters.length} characters for ${data.walletAddress}`);

        // Broadcast character destruction
        if (this.io) {
          this.io.emit('character-destroyed', {
            walletAddress: this.truncateAddress(data.walletAddress),
            characterCount: characters.length,
          });
        }
      }

      // Remove from active battle
      await battleEntryService.removeParticipant(data.walletAddress);
    } catch (error: any) {
      logger.error('Error handling sell:', error);
      throw error;
    }
  }

  /**
   * Verify token purchase transaction on Solana
   */
  private async verifyPurchaseTransaction(
    txSignature: string,
    expectedBuyer: string
  ): Promise<boolean> {
    try {
      const tx = await this.connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        logger.error(`Transaction not found: ${txSignature}`);
        return false;
      }

      // Verify transaction is confirmed
      if (!tx.meta || tx.meta.err) {
        logger.error(`Transaction failed or not confirmed: ${txSignature}`);
        return false;
      }

      // Verify signer matches expected buyer
      const signer = tx.transaction.message.getAccountKeys().get(0);
      if (!signer || signer.toBase58() !== expectedBuyer) {
        logger.error(`Signer mismatch: expected ${expectedBuyer}, got ${signer?.toBase58()}`);
        return false;
      }

      logger.info(`✅ Transaction verified: ${txSignature}`);
      return true;
    } catch (error: any) {
      logger.error(`Error verifying transaction ${txSignature}:`, error);
      return false;
    }
  }

  /**
   * Verify token sell transaction on Solana
   */
  private async verifySellTransaction(
    txSignature: string,
    expectedSeller: string
  ): Promise<boolean> {
    // Same verification logic as purchase
    return this.verifyPurchaseTransaction(txSignature, expectedSeller);
  }

  /**
   * Truncate wallet address for display
   */
  private truncateAddress(address: string): string {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  /**
   * Check if transaction already processed
   */
  async isTransactionProcessed(txSignature: string): Promise<boolean> {
    const existing = await prisma.tokenTransaction.findUnique({
      where: { txSignature },
    });
    return !!existing;
  }
}

// Export singleton instance
export const livePurchaseService = new LivePurchaseService();
export default livePurchaseService;
