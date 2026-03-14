import { Request, Response } from 'express';
import prisma from '../config/database';
import timerService from '../services/timer-service';
import logger from '../config/logger';

/**
 * Get current battle/round information
 * GET /api/battles/current
 */
export async function getCurrentBattle(_req: Request, res: Response) {
  try {
    const currentRound = timerService.getCurrentRound();
    const timerState = timerService.getTimerState();

    const battle = await prisma.battle.findUnique({
      where: { roundId: currentRound },
      include: {
        participants: {
          select: {
            walletAddress: true,
            tokenAmount: true,
            joinedAt: true,
          },
        },
      },
    });

    res.json({
      round: currentRound,
      timer: timerState,
      battle: battle || null,
    });
  } catch (error: any) {
    logger.error('Error getting current battle:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get specific battle by round ID
 * GET /api/battles/:roundId
 */
export async function getBattleByRound(req: Request, res: Response): Promise<void> {
  try {
    const roundId = parseInt(req.params.roundId, 10);

    if (isNaN(roundId)) {
      res.status(400).json({ error: 'Invalid round ID' });
      return;
    }

    const battle = await prisma.battle.findUnique({
      where: { roundId },
      include: {
        participants: {
          select: {
            walletAddress: true,
            tokenAmount: true,
            joinedAt: true,
          },
        },
      },
    });

    if (!battle) {
      res.status(404).json({ error: 'Battle not found' });
      return;
    }

    res.json(battle);
  } catch (error: any) {
    logger.error('Error getting battle:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get battle history
 * GET /api/battles/history
 */
export async function getBattleHistory(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const battles = await prisma.battle.findMany({
      take: limit,
      skip: offset,
      orderBy: { roundId: 'desc' },
      where: {
        status: 'COMPLETE',
      },
      select: {
        roundId: true,
        winnerAddress: true,
        participantCount: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const total = await prisma.battle.count({
      where: { status: 'COMPLETE' },
    });

    res.json({
      battles,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    logger.error('Error getting battle history:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get battle statistics
 * GET /api/battles/stats
 */
export async function getBattleStats(_req: Request, res: Response) {
  try {
    const totalBattles = await prisma.battle.count();
    const completedBattles = await prisma.battle.count({
      where: { status: 'COMPLETE' },
    });
    const totalParticipants = await prisma.participant.count();
    const uniqueParticipants = await prisma.participant.groupBy({
      by: ['walletAddress'],
    });

    res.json({
      totalBattles,
      completedBattles,
      totalParticipations: totalParticipants,
      uniqueParticipants: uniqueParticipants.length,
    });
  } catch (error: any) {
    logger.error('Error getting battle stats:', error);
    res.status(500).json({ error: error.message });
  }
}
