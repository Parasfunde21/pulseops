import { Queue } from 'bullmq';

import { getRedisClient } from '../../config/redis.js';
import {
  githubWebhookJobName,
  healthCheckJobName,
  incidentAiAnalysisJobName,
  type PulseOpsJobData,
  type PulseOpsJobResult,
} from './types.js';

export const jobsQueue = new Queue<PulseOpsJobData, PulseOpsJobResult>(
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

export { githubWebhookJobName, healthCheckJobName, incidentAiAnalysisJobName };
