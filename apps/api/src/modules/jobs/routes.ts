import { Router, type RequestHandler } from 'express';

import { requireAuthentication } from '../../middleware/auth.js';
import { jobsQueue } from './queue.js';
import { healthCheckJobName, type HealthCheckJobData } from './types.js';

function safeFailedReason(reason: string): string {
  if (reason.startsWith('Unsupported job name: ')) {
    return reason;
  }

  if (reason.startsWith('Infrastructure health check failed: ')) {
    return reason;
  }

  return 'Job failed.';
}

export const jobsRouter = (() => {
  const router = Router();
  router.use(requireAuthentication);

  const enqueue: RequestHandler = async (_request, response, next) => {
    try {
      const job = await jobsQueue.add(
        healthCheckJobName,
        { requestedAt: new Date().toISOString() } satisfies HealthCheckJobData,
      );
      response.status(202).json({ message: 'Health check job queued', jobId: job.id });
    } catch (error) {
      next(error);
    }
  };

  const status: RequestHandler = async (request, response, next) => {
    const jobId = request.params.jobId;

    if (typeof jobId !== 'string' || !/^\d+$/.test(jobId)) {
      response.status(404).json({ error: 'Job not found.' });
      return;
    }
    try {
      const job = await jobsQueue.getJob(jobId);
      if (job === undefined) {
        response.status(404).json({ error: 'Job not found.' });
        return;
      }
      const state = await job.getState();
      response.status(200).json({
        id: job.id,
        name: job.name,
        state,
        progress: job.progress,
        createdAt: new Date(job.timestamp).toISOString(),
        ...(job.processedOn === undefined
          ? {}
          : { processedAt: new Date(job.processedOn).toISOString() }),
        ...(job.finishedOn === undefined
          ? {}
          : { finishedAt: new Date(job.finishedOn).toISOString() }),
        ...(job.failedReason === undefined
          ? {}
          : { failedReason: safeFailedReason(job.failedReason) }),
        ...(job.returnvalue === undefined ? {} : { result: job.returnvalue }),
      });
    } catch (error) {
      next(error);
    }
  };

  router.post('/health-check', enqueue);
  router.get('/:jobId', status);
  return router;
})();
