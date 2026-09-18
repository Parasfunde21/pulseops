export type Role = 'member' | 'admin' | 'owner';
export type Severity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
export type IncidentStatus = 'triggered' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface User { id: string; name: string; email: string; createdAt: string; updatedAt: string; }
export interface Organization { id: string; name: string; slug: string; createdAt: string; updatedAt: string; }
export interface Membership { userId: string; role: Role; createdAt: string; updatedAt: string; }
export interface Service { id: string; organizationId: string; name: string; slug: string; description?: string; repositoryUrl?: string; environment?: string; teamName?: string; status: 'active' | 'inactive'; createdBy: string; createdAt: string; updatedAt: string; }
export interface TimelineEvent { type: string; actor: string; timestamp: string; details?: string; }
export interface Incident { id: string; organizationId: string; serviceId: string; title: string; description?: string; severity: Severity; status: IncidentStatus; priority: Priority; createdBy: string; assignedTo?: string; startedAt: string; acknowledgedAt?: string; resolvedAt?: string; resolvedBy?: string; source: string; alertIds?: string[]; deploymentId?: string; timeline: TimelineEvent[]; createdAt: string; updatedAt: string; }
export interface IncidentAnalysis { id: string; organizationId: string; incidentId: string; generatedAt: string; analysis: { summary: string; rootCauseHypotheses: Array<{ hypothesis: string; supportingEvidence: string[]; likelihood: number }>; evidence: string[]; impact: string; recommendedActions: string[]; confidence: number }; provider: string; model: string; createdAt: string; }
export interface Alert { id: string; organizationId: string; serviceId: string; fingerprint: string; name: string; summary?: string; description?: string; severity: Severity; status: 'firing' | 'resolved'; source: string; labels?: Record<string, string>; annotations?: Record<string, string>; startsAt: string; endsAt?: string; lastSeenAt: string; occurrences: number; incidentId?: string; createdAt: string; updatedAt: string; }
export interface AuthResult { accessToken: string; user: User; }
export interface ApiErrorShape { error?: string; }
