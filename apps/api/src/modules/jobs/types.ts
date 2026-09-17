export const healthCheckJobName = 'system.health-check' as const;

export interface HealthCheckJobData {
  requestedAt: string;
}

export interface HealthCheckJobResult {
  mongo: 'ok';
  redis: 'ok';
  checkedAt: string;
}
