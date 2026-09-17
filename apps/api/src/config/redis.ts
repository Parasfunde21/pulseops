import { Redis } from 'ioredis';

import { logger } from '@pulseops/logger';

import { env } from './env.js';

let redisClient: Redis | undefined;

export function getRedisClient(): Redis {
  if (redisClient === undefined) {
    redisClient = new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
    });
    redisClient.on('connect', () => logger.info('Connecting to Redis'));
    redisClient.on('ready', () => logger.info('Connected to Redis'));
    redisClient.on('error', (error: Error) => {
      logger.error('Redis connection error', { error: error.name });
    });
    redisClient.on('close', () => logger.info('Redis connection closed'));
  }

  return redisClient;
}

export async function connectRedis(): Promise<void> {
  try {
    await getRedisClient().ping();
  } catch (error) {
    await disconnectRedis();
    throw error;
  }
}

export async function isRedisReachable(): Promise<boolean> {
  try {
    return (await getRedisClient().ping()) === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient === undefined) {
    return;
  }

  const client = redisClient;
  redisClient = undefined;

  if (client.status !== 'end') {
    await client.quit();
  }

  logger.info('Disconnected from Redis');
}
