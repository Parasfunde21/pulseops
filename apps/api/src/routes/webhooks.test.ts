import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import test from 'node:test';

import express from 'express';

import type { GitHubWebhookJobData } from '../modules/jobs/types.js';
import type { WebhookQueue } from './webhooks.js';

const secret = 'webhook-test-secret';
const organizationA = '507f1f77bcf86cd799439011';
process.env.GITHUB_WEBHOOK_SECRET = secret;

const { disconnectRedis } = await import('../config/redis.js');
const { closeJobsQueue } = await import('../modules/jobs/queue.js');
const { createGithubWebhookHandler } = await import('./webhooks.js');

test.after(async () => {
  await closeJobsQueue();
  await disconnectRedis();
});

interface QueuedJob {
  data: GitHubWebhookJobData;
  id: string;
}

function createTestServer() {
  const jobs: QueuedJob[] = [];
  const queue = {
    add: async (_name: string, data: GitHubWebhookJobData, options?: { jobId?: string }) => {
      const id = options?.jobId ?? `job-${jobs.length + 1}`;
      const existing = jobs.find((job) => job.id === id);
      if (existing !== undefined) {
        return existing;
      }
      const job = { data, id };
      jobs.push(job);
      return job;
    },
  } as WebhookQueue;

  const app = express();
  app.use('/webhooks', express.raw({ type: '*/*' }));
  app.post('/webhooks/github', createGithubWebhookHandler(queue));
  app.post('/webhooks/github/:organizationId', createGithubWebhookHandler(queue));
  const server = http.createServer(app);

  return { jobs, server };
}

function signedBody(body: Buffer): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

async function send(server: http.Server, path: string, body: Buffer, signature?: string, event = 'push'): Promise<{ status: number; json: Record<string, unknown> }> {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test server is not listening.');
  }

  return await new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1', port: address.port, path, method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': body.length,
        'x-github-event': event,
        'x-github-delivery': 'delivery-1',
        ...(signature === undefined ? {} : { 'x-hub-signature-256': signature }),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        json: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>,
      }));
    });
    request.on('error', reject);
    request.end(body);
  });
}

test('signed webhook uses the route organization and duplicate deliveries are idempotent', async () => {
  const { jobs, server } = createTestServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const body = Buffer.from(JSON.stringify({ repository: { full_name: 'pulseops/platform' } }));

  try {
    const first = await send(server, `/webhooks/github/${organizationA}`, body, signedBody(body));
    const duplicate = await send(server, `/webhooks/github/${organizationA}`, body, signedBody(body));

    assert.equal(first.status, 202);
    assert.equal(duplicate.status, 202);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.data.organizationId, organizationA);
    assert.equal(jobs[0]?.data.repository, 'pulseops/platform');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
  }
});

test('invalid and missing webhook signatures are rejected through the HTTP route', async () => {
  const { server } = createTestServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const body = Buffer.from(JSON.stringify({ repository: { full_name: 'pulseops/platform' } }));

  try {
    assert.equal((await send(server, `/webhooks/github/${organizationA}`, body, 'sha256=invalid')).status, 401);
    assert.equal((await send(server, `/webhooks/github/${organizationA}`, body)).status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
  }
});

test('unscoped supported webhooks cannot enqueue and unsupported events remain ignored', async () => {
  const { jobs, server } = createTestServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const body = Buffer.from(JSON.stringify({ repository: { full_name: 'pulseops/platform' } }));

  try {
    assert.equal((await send(server, '/webhooks/github', body, signedBody(body))).status, 400);
    assert.equal((await send(server, '/webhooks/github', body, signedBody(body), 'issues')).status, 202);
    assert.equal(jobs.length, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
  }
});