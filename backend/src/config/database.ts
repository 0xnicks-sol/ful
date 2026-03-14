import { PrismaClient } from '@prisma/client';
import logger from './logger';

// Initialize Prisma Client
const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

// Log Prisma warnings
prisma.$on('warn', (e) => {
  logger.warn('Prisma warning:', e);
});

// Log Prisma errors
prisma.$on('error', (e) => {
  logger.error('Prisma error:', e);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
