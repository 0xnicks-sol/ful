import { Request, Response } from 'express';
import leaderboardService from '../services/leaderboard-service';
import logger from '../config/logger';

/**
 * GET /api/leaderboard
 * Cumulative win totals — ordered by wins desc.
 */
export async function getLeaderboard(req: Request, res: Response) {
  try {
    const limit    = parseInt(req.query.limit as string) || 10;
    const rankings = await leaderboardService.getTopRankings(limit);
    res.json({ rankings, timestamp: new Date().toISOString() });
  } catch (error: any) {
    logger.error('Error getting leaderboard:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/winners
 * Per-round winners — one entry per completed round, ordered by round number.
 * Each entry: { round, walletAddress, completedAt }
 * This is the canonical "who won which round" record straight from the DB.
 */
export async function getRoundWinners(_req: Request, res: Response) {
  try {
    const winners = await leaderboardService.getRoundWinners();
    res.json({ winners, total: winners.length, timestamp: new Date().toISOString() });
  } catch (error: any) {
    logger.error('Error getting round winners:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get rank for specific wallet
 * GET /api/leaderboard/:walletAddress
 */
export async function getWalletRank(req: Request, res: Response): Promise<void> {
  try {
    const { walletAddress } = req.params;

    const rank = await leaderboardService.getRank(walletAddress);

    if (rank === null) {
      res.status(404).json({
        error: 'Wallet not found on leaderboard',
      });
      return;
    }

    res.json({
      walletAddress,
      rank,
    });
  } catch (error: any) {
    logger.error('Error getting wallet rank:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get top 3 winners
 * GET /api/leaderboard/top3
 */
export async function getTop3Winners(_req: Request, res: Response) {
  try {
    const winners = await leaderboardService.getTop3Winners();

    res.json({
      winners,
    });
  } catch (error: any) {
    logger.error('Error getting top 3 winners:', error);
    res.status(500).json({ error: error.message });
  }
}
