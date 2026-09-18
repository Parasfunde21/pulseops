export const healthCheckJobName = 'system.health-check' as const;
export const githubWebhookJobName = 'github.webhook' as const;
export const incidentAiAnalysisJobName = 'incident.ai-analysis' as const;

export interface HealthCheckJobData {
  requestedAt: string;
}

export interface HealthCheckJobResult {
  mongo: 'ok';
  redis: 'ok';
  checkedAt: string;
}

export interface GitHubWebhookJobData {
  organizationId: string;
  eventType: 'push' | 'deployment' | 'deployment_status';
  deliveryId: string;
  repository: string | undefined;
  ref: string | undefined;
  branch: string | undefined;
  sha: string | undefined;
  environment: string | undefined;
  deploymentId: string | undefined;
  deploymentState: string | undefined;
  timestamp: string | undefined;
  message: string | undefined;
  processedAt: string;
}

export interface GitHubWebhookJobResult {
  eventType: GitHubWebhookJobData['eventType'];
  repository: string | undefined;
  matchedServiceCount: number;
  acceptedAt: string;
  status: 'accepted' | 'ignored';
}

export interface IncidentAiAnalysisJobData {
  organizationId: string;
  incidentId: string;
  requestedAt: string;
}

export interface IncidentAiAnalysisJobResult {
  analysisId: string;
  incidentId: string;
  generatedAt: string;
  status: 'completed';
}

export type PulseOpsJobData = HealthCheckJobData | GitHubWebhookJobData | IncidentAiAnalysisJobData;
export type PulseOpsJobResult = HealthCheckJobResult | GitHubWebhookJobResult | IncidentAiAnalysisJobResult;
