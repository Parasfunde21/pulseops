import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { createIncidentAnalysisProvider, validateIncidentAnalysis } from '../../integrations/ai/index.js';
import { incidentOrganizationFilter } from './analysis.js';

const context = {
  incident: { title: 'API latency', severity: 'SEV2', status: 'investigating', priority: 'high', source: 'alert', startedAt: new Date().toISOString() },
  service: { name: 'Gateway', slug: 'gateway' },
  timeline: [],
  alerts: [],
};

test('mock provider returns a bounded deterministic advisory analysis', async () => {
  const provider = createIncidentAnalysisProvider();
  const result = await provider.analyzeIncident(context);
  assert.equal(provider.name, 'mock');
  assert.equal(result.confidence, 0.25);
  assert.ok(result.summary.includes('API latency'));
  assert.ok(result.recommendedActions.length > 0);
});

test('malformed provider output is rejected before persistence', () => {
  assert.throws(
    () => validateIncidentAnalysis({ summary: 'bad', rootCauseHypotheses: [], evidence: [], impact: 'bad', recommendedActions: [], confidence: 1.5 }),
    /malformed incident analysis/,
  );
  assert.throws(
    () => validateIncidentAnalysis({ summary: 'bad', rootCauseHypotheses: [{ hypothesis: 'x', supportingEvidence: [], likelihood: -0.1 }], evidence: [], impact: 'bad', recommendedActions: [], confidence: 0.5 }),
    /malformed incident analysis/,
  );
});

test('incident lookup filters always bind incident and organization IDs', () => {
  const organizationA = incidentOrganizationFilter('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439021');
  const organizationB = incidentOrganizationFilter('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439021');
  assert.equal(organizationA._id.toString(), organizationB._id.toString());
  assert.notEqual(organizationA.organizationId.toString(), organizationB.organizationId.toString());
});

test('analysis request requires authentication before organization access', async () => {
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = 'phase-10-test-secret';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  const { createApp } = await import('../../app.js');
  const { disconnectRedis } = await import('../../config/redis.js');
  const { closeJobsQueue } = await import('../jobs/queue.js');
  const server = http.createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Test server did not start.');

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/organizations/507f1f77bcf86cd799439011/incidents/507f1f77bcf86cd799439021/analysis`, { method: 'POST' });
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
    await closeJobsQueue();
    await disconnectRedis();
  }
});