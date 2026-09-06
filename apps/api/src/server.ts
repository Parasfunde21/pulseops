import type { Server } from 'node:http';

import { logger } from '@pulseops/logger';

import { createApp } from './app.js';
import { env } from './config/env.js';

const server = createApp().listen(env.port, () => {
  logger.info('API server started', { port: env.port });
});

let isShuttingDown = false;

function shutdown(signal: string, httpServer: Server): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('Graceful shutdown started', { signal });

  httpServer.close((error) => {
    if (error !== undefined) {
      logger.error('Server shutdown failed', { error: error.message });
      process.exitCode = 1;
    }

    logger.info('API server stopped');
  });
}

process.on('SIGINT', () => shutdown('SIGINT', server));
process.on('SIGTERM', () => shutdown('SIGTERM', server));
