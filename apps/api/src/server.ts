import type { Server } from 'node:http';

import { logger } from '@pulseops/logger';

import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}

let isShuttingDown = false;

async function shutdown(signal: string, httpServer: Server): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('Graceful shutdown started', { signal });

  try {
    await closeServer(httpServer);
    await disconnectDatabase();
    logger.info('API server stopped');
  } catch (error) {
    logger.error('Graceful shutdown failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    process.exitCode = 1;
  }
}

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    const server = createApp().listen(env.port, () => {
      logger.info('API server started', { port: env.port });
    });

    process.on('SIGINT', () => void shutdown('SIGINT', server));
    process.on('SIGTERM', () => void shutdown('SIGTERM', server));
  } catch (error) {
    logger.error('API startup failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    process.exitCode = 1;
  }
}

void startServer();
