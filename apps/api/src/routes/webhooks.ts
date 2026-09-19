import { Router, type RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import type { Queue } from 'bullmq';

import { env } from '../config/env.js';
import { parseGithubRepositoryUrl, verifyGithubSignature } from '../integrations/github/index.js';
import { recordJobQueued } from '../observability/metrics.js';
import { githubWebhookJobName, jobsQueue } from '../modules/jobs/queue.js';
import type { GitHubWebhookJobData, PulseOpsJobData, PulseOpsJobResult } from '../modules/jobs/types.js';

export type WebhookQueue = Pick<Queue<PulseOpsJobData, PulseOpsJobResult>, 'add'>;

const webhooksRouter = Router();

function readHeader(request: Parameters<RequestHandler>[0], name: string): string | undefined {
  const value = request.get(name);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function readJsonRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readRepositoryName(record: Record<string, unknown>): string | undefined {
  const repository = readJsonRecord(record.repository);
  if (repository === null) {
    return undefined;
  }

  return readString(repository, 'full_name');
}

export function createGithubWebhookHandler(queue: WebhookQueue): RequestHandler {
  return async (request, response, next) => {
  const organizationId = typeof request.params.organizationId === 'string' ? request.params.organizationId : undefined;
  const signature = readHeader(request, 'x-hub-signature-256');
  const deliveryId = readHeader(request, 'x-github-delivery');
  const eventType = readHeader(request, 'x-github-event');

  if (env.githubWebhookSecret === undefined || env.githubWebhookSecret.trim() === '') {
    response.status(503).json({ error: 'GitHub webhook verification is not configured.' });
    return;
  }

  if (signature === undefined) {
    response.status(401).json({ error: 'Missing GitHub webhook signature.' });
    return;
  }

  if (request.body === undefined || (!(request.body instanceof Buffer) && typeof request.body !== 'string')) {
    response.status(400).json({ error: 'Invalid GitHub webhook payload.' });
    return;
  }

  const payloadBuffer = Buffer.isBuffer(request.body) ? request.body : Buffer.from(String(request.body), 'utf8');
  if (!verifyGithubSignature(payloadBuffer, signature, env.githubWebhookSecret)) {
    response.status(401).json({ error: 'Invalid GitHub webhook signature.' });
    return;
  }

  if (eventType === undefined) {
    response.status(202).json({ accepted: true, ignored: true, reason: 'No GitHub event type.' });
    return;
  }

  if (!['push', 'deployment', 'deployment_status'].includes(eventType)) {
    response.status(202).json({ accepted: true, ignored: true, event: eventType });
    return;
  }

  if (organizationId === undefined || !isValidObjectId(organizationId)) {
    response.status(400).json({ error: 'An organization-scoped GitHub webhook URL is required.' });
    return;
  }

  try {
    const parsed = readJsonRecord(JSON.parse(payloadBuffer.toString('utf8')));
    if (parsed === null) {
      response.status(400).json({ error: 'Invalid GitHub webhook payload.' });
      return;
    }

    const repositoryName = readRepositoryName(parsed);
    const normalizedRepository = repositoryName === undefined ? undefined : parseGithubRepositoryUrl(`https://github.com/${repositoryName}`)?.fullName ?? repositoryName;
    const deploymentRecord = readJsonRecord(parsed.deployment);
    const headCommitRecord = readJsonRecord(parsed.head_commit);
    const ref = readString(parsed, 'ref');
    const after = readString(parsed, 'after');
    const sha = after ?? readString(parsed, 'sha');
    const deploymentEnvironment = deploymentRecord === null ? undefined : readString(deploymentRecord, 'environment');
    const deploymentId = deploymentRecord === null ? undefined : readNumber(deploymentRecord, 'id') !== undefined ? String(readNumber(deploymentRecord, 'id')) : undefined;
    const deploymentState = readString(parsed, 'state') ?? (deploymentRecord === null ? undefined : readString(deploymentRecord, 'state'));
    const deploymentTimestamp = headCommitRecord === null ? undefined : readString(headCommitRecord, 'timestamp') ?? (deploymentRecord === null ? undefined : readString(deploymentRecord, 'created_at'));
    const commitMessage = headCommitRecord === null ? undefined : readString(headCommitRecord, 'message');

    const jobPayload: GitHubWebhookJobData = {
      organizationId,
      eventType: eventType as GitHubWebhookJobData['eventType'],
      deliveryId: deliveryId ?? `manual-${Date.now()}`,
      repository: normalizedRepository,
      ref: ref,
      branch: ref !== undefined && ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref,
      sha,
      environment: readString(parsed, 'environment') ?? deploymentEnvironment,
      deploymentId,
      deploymentState,
      timestamp: deploymentTimestamp,
      message: commitMessage,
      processedAt: new Date().toISOString(),
    };

    const job = await queue.add(githubWebhookJobName, jobPayload, {
      jobId: `github-${organizationId}-${(deliveryId ?? `manual-${Date.now()}`).replace(/[^A-Za-z0-9_-]/g, '_')}`,
    });
    recordJobQueued(githubWebhookJobName);
    response.status(202).json({ accepted: true, jobId: job.id, event: eventType });
  } catch (error) {
    next(error);
  }
  };
}

const githubWebhookHandler = createGithubWebhookHandler(jobsQueue);
webhooksRouter.post('/github', githubWebhookHandler);
webhooksRouter.post('/github/:organizationId', githubWebhookHandler);

export { webhooksRouter };
