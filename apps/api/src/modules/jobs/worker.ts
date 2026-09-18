import { Worker, type Job } from 'bullmq';

import { logger } from '@pulseops/logger';
import { Types } from 'mongoose';

import { isDatabaseReachable } from '../../config/database.js';
import { getRedisClient, isRedisReachable } from '../../config/redis.js';
import { parseGithubRepositoryUrl, type GitHubRepositoryReference } from '../../integrations/github/index.js';
import { ServiceModel } from '../../modules/services/index.js';
import { processIncidentAnalysis } from '../incidents/analysis.js';
import {
  githubWebhookJobName,
  healthCheckJobName,
  incidentAiAnalysisJobName,
  type GitHubWebhookJobData,
  type GitHubWebhookJobResult,
  type IncidentAiAnalysisJobData,
  type IncidentAiAnalysisJobResult,
  type HealthCheckJobData,
  type HealthCheckJobResult,
  type PulseOpsJobData,
  type PulseOpsJobResult,
} from './types.js';

async function handleGitHubWebhookJob(job: Job<PulseOpsJobData, PulseOpsJobResult>): Promise<GitHubWebhookJobResult> {
  const payload = job.data as GitHubWebhookJobData;
  logger.info('GitHub webhook job received', {
    jobId: job.id,
    eventType: payload.eventType,
    repository: payload.repository,
    deploymentId: payload.deploymentId,
    deliveryId: payload.deliveryId,
  });

  const supportedEvents = new Set(['push', 'deployment', 'deployment_status']);
  if (!supportedEvents.has(payload.eventType)) {
    return {
      eventType: payload.eventType,
      repository: payload.repository,
      matchedServiceCount: 0,
      acceptedAt: new Date().toISOString(),
      status: 'ignored',
    };
  }

  const repositoryName = payload.repository;
  const repositoryReference = repositoryName === undefined ? null : parseGithubRepositoryUrl(`https://github.com/${repositoryName}`);
  const serviceMatches = repositoryReference === null ? [] : await ServiceModel.find({
    ...githubWebhookServiceFilter(payload.organizationId, repositoryReference),
  }).lean().exec();

  const result: GitHubWebhookJobResult = {
    eventType: payload.eventType,
    repository: repositoryReference?.fullName ?? payload.repository,
    matchedServiceCount: serviceMatches.length,
    acceptedAt: new Date().toISOString(),
    status: 'accepted',
  };

  if (serviceMatches.length === 0) {
    logger.info('GitHub event processed without a matching PulseOps service', {
      eventType: payload.eventType,
      repository: repositoryReference?.fullName ?? payload.repository,
      deliveryId: payload.deliveryId,
    });
    return result;
  }

  const matchedServiceIds = serviceMatches.map((service) => service._id instanceof Types.ObjectId ? service._id.toString() : String(service._id));
  logger.info('GitHub event matched PulseOps services', {
    eventType: payload.eventType,
    repository: repositoryReference?.fullName ?? payload.repository,
    matchedServiceIds,
    deliveryId: payload.deliveryId,
  });
  return result;
}

async function handleIncidentAiAnalysisJob(job: Job<PulseOpsJobData, PulseOpsJobResult>): Promise<IncidentAiAnalysisJobResult> {
  const payload = job.data as IncidentAiAnalysisJobData;
  const analysis = await processIncidentAnalysis(payload.organizationId, payload.incidentId);
  return {
    analysisId: analysis.id,
    incidentId: payload.incidentId,
    generatedAt: analysis.generatedAt.toISOString(),
    status: 'completed',
  };
}

export function githubWebhookServiceFilter(organizationId: string, repositoryReference: GitHubRepositoryReference) {
  return {
    organizationId: new Types.ObjectId(organizationId),
    repositoryUrl: {
      $regex: `github\\.com[/:]${escapeRegex(repositoryReference.owner)}/${escapeRegex(repositoryReference.repo)}(?:\\.git)?`,
      $options: 'i',
    },
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createJobsWorker(): Worker<PulseOpsJobData, PulseOpsJobResult> {
  const worker = new Worker<PulseOpsJobData, PulseOpsJobResult>(
    'pulseops-jobs',
    async (job: Job<PulseOpsJobData, PulseOpsJobResult>) => {
      logger.info('Background job started', { jobId: job.id, name: job.name });

      if (job.name === healthCheckJobName) {
        const data = job.data as HealthCheckJobData;
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
        logger.info('Background job completed', { jobId: job.id, name: job.name, requestedAt: data.requestedAt });
        return result;
      }

      if (job.name === githubWebhookJobName) {
        return await handleGitHubWebhookJob(job);
      }

      if (job.name === incidentAiAnalysisJobName) {
        return await handleIncidentAiAnalysisJob(job);
      }

      throw new Error(`Unsupported job name: ${job.name}`);
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
