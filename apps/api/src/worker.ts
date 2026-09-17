import { logger } from '@pulseops/logger';

import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { createJobsWorker } from './modules/jobs/worker.js';

let shuttingDown = false;

async function shutdown(signal: string, worker: ReturnType<typeof createJobsWorker>): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Jobs worker shutting down', { signal });
  try {
    await worker.close();
    await disconnectRedis();
    await disconnectDatabase();
    logger.info('Jobs worker stopped');
  } catch (error) {
    logger.error('Jobs worker shutdown failed', { error: error instanceof Error ? error.name : 'UnknownError' });
    process.exitCode = 1;
  }
}

async function startWorker(): Promise<void> {
  try {
    await connectDatabase();
    await connectRedis();
    const worker = createJobsWorker();
    process.on('SIGINT', () => void shutdown('SIGINT', worker));
    process.on('SIGTERM', () => void shutdown('SIGTERM', worker));
  } catch (error) {
    logger.error('Jobs worker startup failed', { error: error instanceof Error ? error.name : 'UnknownError' });
    process.exitCode = 1;
  }
}

void startWorker();
