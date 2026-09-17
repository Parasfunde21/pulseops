import { Worker, type Job } from 'bullmq';

import { logger } from '@pulseops/logger';

import { isDatabaseReachable } from '../../config/database.js';
import { getRedisClient, isRedisReachable } from '../../config/redis.js';
import {
  healthCheckJobName,
  type HealthCheckJobData,
  type HealthCheckJobResult,
} from './types.js';

export function createJobsWorker(): Worker<HealthCheckJobData, HealthCheckJobResult> {
  const worker = new Worker<HealthCheckJobData, HealthCheckJobResult>(
    'pulseops-jobs',
    async (job: Job<HealthCheckJobData, HealthCheckJobResult>) => {
      logger.info('Background job started', { jobId: job.id, name: job.name });
      if (job.name !== healthCheckJobName) {
        throw new Error(`Unsupported job name: ${job.name}`);
      }

      const mongo = await isDatabaseReachable();
      const redis = await isRedisReachable();
      if (!mongo || !redis) {
        throw new Error(
          `Infrastructure health check failed: mongo=${mongo ? 'ok' : 'unavailable'}, redis=${redis ? 'ok' : 'unavailable'}`,
        );
      }

      const result: HealthCheckJobResult = {
        mongo: 'ok',
        redis: 'ok',
        checkedAt: new Date().toISOString(),
      };
      logger.info('Background job completed', { jobId: job.id, name: job.name });
      return result;
    },
    { connection: getRedisClient(), concurrency: 1 },
  );

  worker.on('failed', (job, error) => {
    logger.error('Background job failed', {
      jobId: job?.id,
      name: job?.name,
      error: error.name,
    });
  });
  worker.on('error', (error) => {
    logger.error('Jobs worker error', { error: error.name });
  });
  logger.info('Jobs worker started', { queue: 'pulseops-jobs' });
  return worker;
}
