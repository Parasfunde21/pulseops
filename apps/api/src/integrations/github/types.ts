export interface GitHubRepositoryMetadata {
  id: number;
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  description: string | null;
  stars: number;
  openIssues: number;
  updatedAt: string | undefined;
  pushedAt: string | undefined;
}

export interface GitHubCommitSummary {
  sha: string;
  message: string | null;
  authorName: string | null;
  authorEmail: string | null;
  committedAt: string | undefined;
}

export interface GitHubRepositoryReference {
  owner: string;
  repo: string;
  fullName: string;
  isGitHub: true;
}

export interface GitHubEventMetadata {
  repository?: string;
  ref?: string;
  sha?: string;
  environment?: string;
  deploymentId?: string;
  state?: string;
  timestamp?: string;
  message?: string;
}

export interface GitHubPushPayload {
  ref?: string;
  before?: string;
  after?: string;
  head_commit?: {
    id?: string;
    message?: string;
    timestamp?: string;
    author?: {
      name?: string;
      email?: string;
    };
  };
  repository?: {
    full_name?: string;
    private?: boolean;
    default_branch?: string;
    html_url?: string;
    description?: string | null;
    stargazers_count?: number;
    open_issues_count?: number;
  };
  pusher?: {
    name?: string;
  };
}

export interface GitHubDeploymentPayload {
  deployment?: {
    id?: number;
    environment?: string;
    ref?: string;
    sha?: string;
    state?: string;
    created_at?: string;
    updated_at?: string;
  };
  repository?: {
    full_name?: string;
    html_url?: string;
    private?: boolean;
    default_branch?: string;
    description?: string | null;
    stargazers_count?: number;
    open_issues_count?: number;
  };
  ref?: string;
  environment?: string;
  sha?: string;
  state?: string;
}
