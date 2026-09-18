import type { Alert, AuthResult, Incident, IncidentAnalysis, Membership, Organization, Service, User } from '../types/api';
import { storage } from './storage';

const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'ApiError'; }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  const token = storage.getToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  let payload: unknown = undefined;
  try { payload = text ? JSON.parse(text) : undefined; } catch { payload = undefined; }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`;
    if (response.status === 401) storage.clearToken();
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const orgPath = (organizationId: string, resource: string) => `/organizations/${organizationId}/${resource}`;

export const api = {
  login: (email: string, password: string) => request<AuthResult>('/auth/login', json({ email, password })),
  me: () => request<{ user: User }>('/auth/me'),
  organizations: () => request<{ organizations: Organization[] }>('/organizations'),
  members: (organizationId: string) => request<{ members: Membership[] }>(orgPath(organizationId, 'members')),
  services: (organizationId: string) => request<{ services: Service[] }>(orgPath(organizationId, 'services')),
  createService: (organizationId: string, body: { name: string; slug?: string | undefined; description?: string | undefined; repositoryUrl?: string | undefined; environment?: string | undefined; teamName?: string | undefined; status?: Service['status'] | undefined }) => request<{ service: Service }>(orgPath(organizationId, 'services'), json(body)),
  incidents: (organizationId: string, filters?: { status?: string; severity?: string }) => request<{ incidents: Incident[] }>(`${orgPath(organizationId, 'incidents')}${filters ? `?${new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)))}` : ''}`),
  incident: (organizationId: string, incidentId: string) => request<{ incident: Incident }>(orgPath(organizationId, `incidents/${incidentId}`)),
  updateIncident: (organizationId: string, incidentId: string, body: Partial<Incident>) => request<{ incident: Incident }>(orgPath(organizationId, `incidents/${incidentId}`), { method: 'PATCH', body: JSON.stringify(body) }),
  incidentAction: (organizationId: string, incidentId: string, action: 'acknowledge' | 'resolve' | 'reopen') => request<{ incident: Incident }>(orgPath(organizationId, `incidents/${incidentId}/${action}`), json({})),
  incidentAnalysis: (organizationId: string, incidentId: string) => request<{ analysis: IncidentAnalysis | null; history: IncidentAnalysis[] }>(orgPath(organizationId, `incidents/${incidentId}/analysis`)),
  requestIncidentAnalysis: (organizationId: string, incidentId: string) => request<{ message: string; jobId: string; incidentId: string }>(orgPath(organizationId, `incidents/${incidentId}/analysis`), json({})),
  alerts: (organizationId: string, filters?: { status?: string; severity?: string; source?: string }) => request<{ alerts: Alert[] }>(`${orgPath(organizationId, 'alerts')}${filters ? `?${new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)))}` : ''}`),
  createAlert: (organizationId: string, body: { serviceId: string; fingerprint: string; name: string; severity: Alert['severity']; source: string; startsAt: string; summary?: string; description?: string; labels?: Record<string, string>; annotations?: Record<string, string>; status?: Alert['status'] }) => request<{ alert: Alert }>(orgPath(organizationId, 'alerts'), json(body)),
  alert: (organizationId: string, alertId: string) => request<{ alert: Alert }>(orgPath(organizationId, `alerts/${alertId}`)),
  resolveAlert: (organizationId: string, alertId: string) => request<{ alert: Alert }>(orgPath(organizationId, `alerts/${alertId}/resolve`), json({})),
  enqueueHealthCheck: () => request<{ message: string; jobId: string }>('/jobs/health-check', json({})),
  jobStatus: (jobId: string) => request<{ id: string; name: string; state: string; progress: number | object; createdAt: string; processedAt?: string; finishedAt?: string; failedReason?: string; result?: { mongo: 'ok'; redis: 'ok'; checkedAt: string } }>(`/jobs/${jobId}`),
};
