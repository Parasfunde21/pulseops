import { createHmac, timingSafeEqual } from 'node:crypto';

import type { GitHubRepositoryReference } from './types.js';

export function parseGithubRepositoryUrl(value: string): GitHubRepositoryReference | null {
  const trimmed = value.trim();
  const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(trimmed);
  if (sshMatch !== null) {
    const owner = sshMatch[1];
    const repo = sshMatch[2];
    if (typeof owner === 'string' && owner !== '' && typeof repo === 'string' && repo !== '') {
      return { owner, repo, fullName: `${owner}/${repo}`, isGitHub: true };
    }
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname !== 'github.com' && hostname !== 'www.github.com') {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean).map((segment) => segment.replace(/\.git$/i, ''));
    if (segments.length !== 2) {
      return null;
    }

    const [owner, repo] = segments;
    if (!owner || !repo || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
      return null;
    }

    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      isGitHub: true,
    };
  } catch {
    return null;
  }
}

export function verifyGithubSignature(payload: Buffer | string | Uint8Array, signature: string | undefined, secret: string | undefined): boolean {
  if (typeof signature !== 'string' || signature.trim() === '') {
    return false;
  }

  if (typeof secret !== 'string' || secret.trim() === '') {
    return false;
  }

  const expectedPrefix = 'sha256=';
  if (!signature.startsWith(expectedPrefix)) {
    return false;
  }

  const incoming = Buffer.from(signature.slice(expectedPrefix.length), 'hex');
  const expected = createHmac('sha256', secret).update(Buffer.isBuffer(payload) ? payload : Buffer.from(payload)).digest();

  if (incoming.length !== expected.length) {
    return false;
  }

  try {
    return timingSafeEqual(expected, incoming);
  } catch {
    return false;
  }
}

export { type GitHubRepositoryReference };
