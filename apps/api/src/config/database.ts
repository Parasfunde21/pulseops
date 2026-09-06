import { logger } from '@pulseops/logger';
import { setServers } from 'node:dns';
import mongoose from 'mongoose';

import { env } from './env.js';

function connectionFailureCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (/authentication|auth failed/i.test(message)) {
    return 'authentication';
  }

  if (/dns|enotfound|querysrv|srv/i.test(message)) {
    return 'dns';
  }

  if (/tls|ssl|certificate/i.test(message)) {
    return 'tls';
  }

  if (/timeout|timed out|etimedout|econnrefused|network/i.test(message)) {
    return 'network';
  }

  return 'unknown';
}

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
    return;
  }

  logger.info('Connecting to MongoDB');

  try {
    setServers([env.mongoDbDnsServer]);
    await mongoose.connect(env.mongoDbUri);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
      category: connectionFailureCategory(error),
    });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === mongoose.ConnectionStates.disconnected) {
    return;
  }

  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

export async function isDatabaseReachable(): Promise<boolean> {
  if (!isDatabaseConnected() || mongoose.connection.db === undefined) {
    return false;
  }

  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    logger.error('MongoDB health check failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return false;
  }
}
