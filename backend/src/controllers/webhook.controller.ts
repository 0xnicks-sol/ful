import { Request, Response } from 'express';
import logger from '../config/logger';
import livePurchaseService from '../services/live-purchases';

/**
 * Webhook handler for token purchases
 * POST /api/webhooks/token-purchase
 */
export async function handleTokenPurchase(req: Request, res: Response): Promise<void> {
  try {
    const { walletAddress, txSignature, tokenAmount, timestamp } = req.body;

    // Validate required fields
    if (!walletAddress || !txSignature || !tokenAmount) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: walletAddress, txSignature, tokenAmount',
      });
      return;
    }

    // Check if transaction already processed
    const alreadyProcessed = await livePurchaseService.isTransactionProcessed(txSignature);
    if (alreadyProcessed) {
      logger.warn(`Transaction already processed: ${txSignature}`);
      res.status(200).json({
        success: true,
        message: 'Transaction already processed',
      });
      return;
    }

    // Process purchase
    await livePurchaseService.handlePurchase({
      walletAddress,
      txSignature,
      tokenAmount: parseFloat(tokenAmount),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'Token purchase processed',
    });
  } catch (error: any) {
    logger.error('Error in handleTokenPurchase:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Webhook handler for token sells
 * POST /api/webhooks/token-sell
 */
export async function handleTokenSell(req: Request, res: Response): Promise<void> {
  try {
    const { walletAddress, txSignature, tokenAmount, timestamp } = req.body;

    // Validate required fields
    if (!walletAddress || !txSignature || !tokenAmount) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: walletAddress, txSignature, tokenAmount',
      });
      return;
    }

    // Check if transaction already processed
    const alreadyProcessed = await livePurchaseService.isTransactionProcessed(txSignature);
    if (alreadyProcessed) {
      logger.warn(`Transaction already processed: ${txSignature}`);
      res.status(200).json({
        success: true,
        message: 'Transaction already processed',
      });
      return;
    }

    // Process sell
    await livePurchaseService.handleSell({
      walletAddress,
      txSignature,
      tokenAmount: parseFloat(tokenAmount),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'Token sell processed',
    });
  } catch (error: any) {
    logger.error('Error in handleTokenSell:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
