import { env } from '../../config/env.js';
import type { GitHubCommitSummary, GitHubRepositoryMetadata } from './types.js';

const githubApiRoot = env.githubApiUrl.replace(/\/$/, '');

export class GitHubApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: 'unauthorized' | 'forbidden' | 'not_found' | 'rate_limited' | 'server_error' | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

async function requestJson<T>(path: string): Promise<T> {
  const headers = new Headers({
    Accept: 'application/vnd.github+json',
    'User-Agent': 'PulseOps/1.0',
  });

  if (env.githubToken !== undefined && env.githubToken !== '') {
    headers.set('Authorization', `Bearer ${env.githubToken}`);
  }

  const response = await fetch(`${githubApiRoot}${path}`, { headers });
  if (!response.ok) {
    const code =
      response.status === 401 ? 'unauthorized'
      : response.status === 403 ? 'forbidden'
      : response.status === 404 ? 'not_found'
      : response.status === 429 ? 'rate_limited'
      : response.status >= 500 ? 'server_error'
      : 'unknown';

    throw new GitHubApiError(
      response.status,
      code,
      code === 'not_found' ? 'GitHub repository could not be found.'
        : code === 'unauthorized' ? 'GitHub authentication failed.'
        : code === 'forbidden' ? 'GitHub access is forbidden.'
        : code === 'rate_limited' ? 'GitHub rate limit exceeded.'
        : code === 'server_error' ? 'GitHub service is temporarily unavailable.'
        : 'GitHub repository could not be retrieved.',
    );
  }

  return await response.json() as T;
}

export async function getRepositoryMetadata(owner: string, repo: string): Promise<GitHubRepositoryMetadata> {
  const payload = await requestJson<{
    id: number;
    full_name: string;
    name: string;
    private: boolean;
    default_branch: string;
    html_url: string;
    description?: string | null;
    stargazers_count: number;
    open_issues_count: number;
    updated_at?: string;
    pushed_at?: string;
  }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);

  return {
    id: payload.id,
    fullName: payload.full_name,
    name: payload.name,
    private: payload.private,
    defaultBranch: payload.default_branch,
    htmlUrl: payload.html_url,
    description: payload.description ?? null,
    stars: payload.stargazers_count,
    openIssues: payload.open_issues_count,
    updatedAt: payload.updated_at,
    pushedAt: payload.pushed_at,
  };
}

export async function getRepositoryCommits(owner: string, repo: string, branch?: string): Promise<GitHubCommitSummary[]> {
  const query = branch === undefined ? '' : `?sha=${encodeURIComponent(branch)}`;
  const payload = await requestJson<Array<{
    sha: string;
    commit?: {
      message?: string;
      author?: {
        name?: string;
        email?: string;
        date?: string;
      };
    };
  }>>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits${query}`);

  return payload.slice(0, 5).map((entry) => ({
    sha: entry.sha,
    message: entry.commit?.message ?? null,
    authorName: entry.commit?.author?.name ?? null,
    authorEmail: entry.commit?.author?.email ?? null,
    committedAt: entry.commit?.author?.date,
  }));
}
