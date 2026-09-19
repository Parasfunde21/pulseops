import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import express from 'express';

import { observabilityMiddleware } from '../middleware/observability.js';
import { metricsRouter } from '../routes/metrics.js';
import { createReadinessRouter } from '../routes/ready.js';
import {
  recordJobCompleted,
  recordJobFailed,
  recordJobQueued,
  renderMetrics,
  resetMetricsForTests,
} from './metrics.js';

function listen(app: express.Express): Promise<http.Server> {
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

async function close(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
}

async function request(server: http.Server, path: string, headers?: Record<string, string>): Promise<Response> {
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Test server did not start.');
  return fetch(`http://127.0.0.1:${address.port}${path}`, headers === undefined ? undefined : { headers });
}

test.beforeEach(() => resetMetricsForTests());

test('request IDs are preserved and generated when absent', async () => {
  const app = express();
  app.use(observabilityMiddleware);
  app.get('/check', (_request, response) => response.sendStatus(204));
  const server = await listen(app);

  try {
    const supplied = await request(server, '/check', { 'x-request-id': 'client-request-1' });
    const generated = await request(server, '/check');
    assert.equal(supplied.headers.get('x-request-id'), 'client-request-1');
    assert.match(generated.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
  } finally {
    await close(server);
  }
});

test('readiness reports both dependency success and failure', async () => {
  const readyApp = express();
  readyApp.use('/ready', createReadinessRouter({ database: async () => true, redis: async () => true }));
  const unavailableApp = express();
  unavailableApp.use('/ready', createReadinessRouter({ database: async () => true, redis: async () => false }));
  const readyServer = await listen(readyApp);
  const unavailableServer = await listen(unavailableApp);

  try {
    assert.equal((await request(readyServer, '/ready')).status, 200);
    assert.equal((await request(unavailableServer, '/ready')).status, 503);
  } finally {
    await close(readyServer);
    await close(unavailableServer);
  }
});

test('metrics use Prometheus format and bounded labels', () => {
  recordJobQueued('system.health-check');
  recordJobCompleted('system.health-check');
  recordJobFailed('system.health-check');
  recordJobQueued('unsupported-job-name');
  const output = renderMetrics();

  assert.match(output, /# TYPE http_requests_total counter/);
  assert.match(output, /# TYPE http_request_duration_seconds histogram/);
  assert.match(output, /bullmq_jobs_total\{job_name="system\.health-check",status="queued"\} 1/);
  assert.match(output, /bullmq_jobs_total\{job_name="system\.health-check",status="completed"\} 1/);
  assert.match(output, /bullmq_jobs_total\{job_name="system\.health-check",status="failed"\} 1/);
  assert.doesNotMatch(output, /unsupported-job-name|507f1f77bcf86cd799439011|Bearer|webhook-secret/);
});

test('metrics endpoint returns Prometheus text exposition', async () => {
  const app = express();
  app.use('/metrics', metricsRouter);
  const server = await listen(app);

  try {
    const response = await request(server, '/metrics');
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^text\/plain/);
    assert.match(body, /# HELP process_uptime_seconds/);
  } finally {
    await close(server);
  }
});