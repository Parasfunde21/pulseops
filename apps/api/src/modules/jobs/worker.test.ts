import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGithubRepositoryUrl } from '../../integrations/github/index.js';
import { githubWebhookServiceFilter } from './worker.js';

test('GitHub service correlation keeps identical repositories isolated by organization', () => {
  const repository = parseGithubRepositoryUrl('https://github.com/pulseops/platform');
  if (repository === null) {
    throw new Error('Expected a valid GitHub repository reference.');
  }
  const organizationA = githubWebhookServiceFilter('507f1f77bcf86cd799439011', repository);
  const organizationB = githubWebhookServiceFilter('507f1f77bcf86cd799439012', repository);

  assert.equal(organizationA.repositoryUrl.$regex, organizationB.repositoryUrl.$regex);
  assert.notEqual(organizationA.organizationId.toString(), organizationB.organizationId.toString());
});