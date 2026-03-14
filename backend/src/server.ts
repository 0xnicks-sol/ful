import express, { Express } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './config/logger';
import timerService from './services/timer-service';
import battleEntryService from './services/battle-entry';
import livePurchaseService from './services/live-purchases';
import battleEngine from './services/battle-engine';
import leaderboardService from './services/leaderboard-service';
import { handleTokenPurchase, handleTokenSell } from './controllers/webhook.controller';
import { handleHeliusWebhook } from './controllers/helius.controller';
import {
  getCurrentBattle,
  getBattleByRound,
  getBattleHistory,
  getBattleStats,
} from './controllers/battle.controller';
import {
  getLeaderboard,
  getWalletRank,
  getTop3Winners,
} from './controllers/leaderboard.controller';

// Load environment variables
dotenv.config();

const app: Express = express();
const httpServer = createServer(app);

// Socket.IO configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api/timer/state', (_req, res) => {
  res.json(timerService.getTimerState());
});

// Battle routes
app.get('/api/battles/current', getCurrentBattle);
app.get('/api/battles/history', getBattleHistory);
app.get('/api/battles/stats', getBattleStats);
app.get('/api/battles/:roundId', getBattleByRound);

// Leaderboard routes
app.get('/api/leaderboard', getLeaderboard);
app.get('/api/leaderboard/top3', getTop3Winners);
app.get('/api/leaderboard/:walletAddress', getWalletRank);

// ── Helius webhook (pump.fun buy/sell auto-detected from on-chain events)
// Set this URL in your Helius dashboard: https://your-backend.com/api/webhooks/helius
app.post('/api/webhooks/helius', handleHeliusWebhook);

// ── Manual / legacy webhook routes (for testing or custom integrations)
app.post('/api/webhooks/token-purchase', handleTokenPurchase);
app.post('/api/webhooks/token-sell', handleTokenSell);

// Admin routes
app.post('/api/admin/start-round', (req, res): void => {
  const { roundId } = req.body;
  
  if (timerService.isActive()) {
    res.status(400).json({ error: 'Timer already active' });
    return;
  }
  
  timerService.startTimer(roundId);
  res.json({ success: true, round: timerService.getCurrentRound() });
});

app.post('/api/admin/reset-tournament', async (_req, res) => {
  try {
    await leaderboardService.resetLeaderboard();
    timerService.resetRounds();
    res.json({ success: true, message: 'Tournament reset' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Send current timer state on connection
  socket.emit('timer-tick', timerService.getTimerState());

  // Handle client disconnect
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });

  // Note: No manual join-battle event needed
  // Users auto-join via token purchase webhook
});

// Initialize services
timerService.initialize(io);
battleEntryService.initialize(io);
livePurchaseService.initialize(io);
battleEngine.initialize(io);
leaderboardService.initialize(io);

// Listen for timer end to trigger battle
io.on('timer-end', (data) => {
  logger.info('Timer ended, executing battle...');
  battleEngine.executeBattle(data.round, data.participantCount);
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📡 Socket.IO enabled`);
  logger.info(`🌍 CORS origin: ${process.env.CORS_ORIGIN}`);
  logger.info(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Auto-start first round in development
  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      logger.info('🎮 Auto-starting first round...');
      timerService.startTimer(1);
    }, 3000);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  timerService.stopTimer();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { app, io };
