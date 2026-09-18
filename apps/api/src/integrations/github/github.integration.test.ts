import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { parseGithubRepositoryUrl, verifyGithubSignature } from './index.js';

test('parseGithubRepositoryUrl accepts GitHub URLs', () => {
  assert.deepEqual(parseGithubRepositoryUrl('https://github.com/pulseops/platform'), {
    owner: 'pulseops',
    repo: 'platform',
    fullName: 'pulseops/platform',
    isGitHub: true,
  });
});

test('parseGithubRepositoryUrl rejects non-GitHub URLs', () => {
  assert.equal(parseGithubRepositoryUrl('https://gitlab.com/pulseops/platform'), null);
});

test('verifyGithubSignature compares the HMAC with a timing-safe comparison', () => {
  const secret = 'super-secret';
  const payload = Buffer.from(JSON.stringify({ ok: true }));
  const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

  assert.equal(verifyGithubSignature(payload, signature, secret), true);
  assert.equal(verifyGithubSignature(payload, 'sha256=bad', secret), false);
});
