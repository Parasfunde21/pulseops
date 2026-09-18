import { env } from '../../config/env.js';

export interface IncidentAnalysisContext {
  incident: {
    title: string;
    description?: string;
    severity: string;
    status: string;
    priority: string;
    source: string;
    startedAt: string;
    deploymentId?: string;
  };
  service: {
    name: string;
    slug: string;
    description?: string;
    environment?: string;
    teamName?: string;
    repositoryUrl?: string;
  };
  timeline: Array<{ type: string; timestamp: string; details?: string }>;
  alerts: Array<{
    name: string;
    summary?: string;
    description?: string;
    severity: string;
    status: string;
    source: string;
    occurrences: number;
    startsAt: string;
    lastSeenAt: string;
  }>;
  deployment?: { id: string };
}

export interface IncidentRootCauseHypothesis {
  hypothesis: string;
  supportingEvidence: string[];
  likelihood: number;
}

export interface IncidentAnalysis {
  summary: string;
  rootCauseHypotheses: IncidentRootCauseHypothesis[];
  evidence: string[];
  impact: string;
  recommendedActions: string[];
  confidence: number;
}

export interface IncidentAnalysisProvider {
  readonly name: string;
  readonly model: string;
  analyzeIncident(context: IncidentAnalysisContext): Promise<IncidentAnalysis>;
}

const maxText = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maximum = maxText): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}

function boundedNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function textArray(value: unknown, maximumItems: number, maximumText = 1000): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems && value.every((item) => boundedText(item, maximumText));
}

export function validateIncidentAnalysis(value: unknown): IncidentAnalysis {
  if (!isRecord(value) || !boundedText(value.summary) || !boundedText(value.impact) || !textArray(value.evidence, 20) || !textArray(value.recommendedActions, 20) || !boundedNumber(value.confidence)) {
    throw new Error('AI provider returned malformed incident analysis.');
  }

  if (!Array.isArray(value.rootCauseHypotheses) || value.rootCauseHypotheses.length > 10) {
    throw new Error('AI provider returned malformed incident analysis.');
  }

  const rootCauseHypotheses = value.rootCauseHypotheses.map((item) => {
    if (!isRecord(item) || !boundedText(item.hypothesis) || !textArray(item.supportingEvidence, 10) || !boundedNumber(item.likelihood)) {
      throw new Error('AI provider returned malformed incident analysis.');
    }
    return {
      hypothesis: item.hypothesis,
      supportingEvidence: item.supportingEvidence,
      likelihood: item.likelihood,
    };
  });

  return {
    summary: value.summary,
    rootCauseHypotheses,
    evidence: value.evidence,
    impact: value.impact,
    recommendedActions: value.recommendedActions,
    confidence: value.confidence,
  };
}

class MockIncidentAnalysisProvider implements IncidentAnalysisProvider {
  readonly name = 'mock';
  readonly model: string;

  constructor(model: string) { this.model = model; }

  async analyzeIncident(context: IncidentAnalysisContext): Promise<IncidentAnalysis> {
    const alertEvidence = context.alerts.slice(0, 3).map((alert) => `${alert.name} (${alert.status}, ${alert.occurrences} occurrence${alert.occurrences === 1 ? '' : 's'})`);
    const evidence = [
      `Incident is ${context.incident.status} with ${context.incident.severity} severity and ${context.incident.priority} priority.`,
      ...alertEvidence,
    ];
    return validateIncidentAnalysis({
      summary: `Investigation summary for ${context.incident.title}. Review the correlated alerts and timeline before taking action.`,
      rootCauseHypotheses: context.alerts.length === 0 ? [] : [{
        hypothesis: 'A correlated alert signal is contributing to the incident.',
        supportingEvidence: alertEvidence.length > 0 ? alertEvidence : ['The incident has correlated alert context.'],
        likelihood: 0.5,
      }],
      evidence,
      impact: `Impact is associated with the ${context.service.name} service and should be confirmed against current service health.`,
      recommendedActions: [
        'Confirm the affected service scope and current customer impact.',
        'Review the correlated alert timeline and recent deployment context.',
        'Validate any remediation in a controlled, reversible way.',
      ],
      confidence: context.alerts.length === 0 ? 0.25 : 0.5,
    });
  }
}

class HttpIncidentAnalysisProvider implements IncidentAnalysisProvider {
  readonly name = 'http';
  readonly model: string;

  constructor(private readonly url: string, private readonly apiKey: string, model: string) { this.model = model; }

  async analyzeIncident(context: IncidentAnalysisContext): Promise<IncidentAnalysis> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, context }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`AI provider request failed with status ${response.status}.`);
    const payload: unknown = await response.json();
    const analysis = isRecord(payload) && 'analysis' in payload ? payload.analysis : payload;
    return validateIncidentAnalysis(analysis);
  }
}

export function createIncidentAnalysisProvider(): IncidentAnalysisProvider {
  if (env.aiProvider === 'mock') return new MockIncidentAnalysisProvider(env.aiModel);
  if (env.aiApiUrl === undefined || env.aiApiKey === undefined) throw new Error('AI provider configuration is incomplete.');
  return new HttpIncidentAnalysisProvider(env.aiApiUrl, env.aiApiKey, env.aiModel);
}