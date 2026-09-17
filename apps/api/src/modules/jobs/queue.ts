import { Queue } from 'bullmq';

import { getRedisClient } from '../../config/redis.js';
import { healthCheckJobName, type HealthCheckJobData, type HealthCheckJobResult } from './types.js';

export const jobsQueue = new Queue<HealthCheckJobData, HealthCheckJobResult>(
  'pulseops-jobs',
  {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400, count: 100 },
    },
  },
);

export async function closeJobsQueue(): Promise<void> {
  await jobsQueue.close();
}

export { healthCheckJobName };
