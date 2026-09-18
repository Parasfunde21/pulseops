import { model, Schema, Types, type HydratedDocument } from 'mongoose';

import { AlertModel } from '../alerts/index.js';
import { ServiceModel } from '../services/index.js';
import { createIncidentAnalysisProvider, validateIncidentAnalysis, type IncidentAnalysis, type IncidentAnalysisContext, type IncidentAnalysisProvider } from '../../integrations/ai/index.js';
import { IncidentModel } from './index.js';

export interface IncidentAnalysisRecord {
  organizationId: Types.ObjectId;
  incidentId: Types.ObjectId;
  generatedAt: Date;
  analysis: IncidentAnalysis;
  provider: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export type IncidentAnalysisDocument = HydratedDocument<IncidentAnalysisRecord>;

const hypothesisSchema = new Schema(
  {
    hypothesis: { type: String, required: true, maxlength: 4000 },
    supportingEvidence: { type: [String], required: true, maxlength: 10 },
    likelihood: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const resultSchema = new Schema(
  {
    summary: { type: String, required: true, maxlength: 4000 },
    rootCauseHypotheses: { type: [hypothesisSchema], required: true, maxlength: 10 },
    evidence: { type: [String], required: true, maxlength: 20 },
    impact: { type: String, required: true, maxlength: 4000 },
    recommendedActions: { type: [String], required: true, maxlength: 20 },
    confidence: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const analysisSchema = new Schema<IncidentAnalysisRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization' },
    incidentId: { type: Schema.Types.ObjectId, required: true, ref: 'Incident' },
    generatedAt: { type: Date, required: true, default: Date.now },
    analysis: { type: resultSchema, required: true },
    provider: { type: String, required: true, maxlength: 80 },
    model: { type: String, required: true, maxlength: 160 },
  },
  { timestamps: true },
);

analysisSchema.index({ organizationId: 1, incidentId: 1, generatedAt: -1 });

export const IncidentAnalysisModel = model<IncidentAnalysisRecord>('IncidentAnalysis', analysisSchema);

export class IncidentAnalysisIncidentNotFoundError extends Error {}
export class IncidentAnalysisServiceNotFoundError extends Error {}

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

export function incidentOrganizationFilter(organizationId: string, incidentId: string) {
  return { _id: objectId(incidentId), organizationId: objectId(organizationId) };
}

export async function buildIncidentAnalysisContext(organizationId: string, incidentId: string): Promise<IncidentAnalysisContext> {
  const tenant = objectId(organizationId);
  const incident = await IncidentModel.findOne(incidentOrganizationFilter(organizationId, incidentId)).exec();
  if (incident === null) throw new IncidentAnalysisIncidentNotFoundError();

  const service = await ServiceModel.findOne({ _id: incident.serviceId, organizationId: tenant }).exec();
  if (service === null) throw new IncidentAnalysisServiceNotFoundError();

  const alertIds = incident.alertIds?.slice(0, 50) ?? [];
  const alerts = alertIds.length === 0 ? [] : await AlertModel.find({ _id: { $in: alertIds }, organizationId: tenant }).sort({ lastSeenAt: -1 }).limit(50).exec();

  return {
    incident: {
      title: incident.title,
      ...(incident.description === undefined ? {} : { description: incident.description.slice(0, 4000) }),
      severity: incident.severity,
      status: incident.status,
      priority: incident.priority,
      source: incident.source,
      startedAt: incident.startedAt.toISOString(),
      ...(incident.deploymentId === undefined ? {} : { deploymentId: incident.deploymentId }),
    },
    service: {
      name: service.name,
      slug: service.slug,
      ...(service.description === undefined ? {} : { description: service.description.slice(0, 1000) }),
      ...(service.environment === undefined ? {} : { environment: service.environment }),
      ...(service.teamName === undefined ? {} : { teamName: service.teamName }),
      ...(service.repositoryUrl === undefined ? {} : { repositoryUrl: service.repositoryUrl }),
    },
    timeline: incident.timeline.slice(-50).map((event) => ({
      type: event.type,
      timestamp: event.timestamp.toISOString(),
      ...(event.details === undefined ? {} : { details: event.details.slice(0, 1000) }),
    })),
    alerts: alerts.map((alert) => ({
      name: alert.name,
      ...(alert.summary === undefined ? {} : { summary: alert.summary.slice(0, 1000) }),
      ...(alert.description === undefined ? {} : { description: alert.description.slice(0, 2000) }),
      severity: alert.severity,
      status: alert.status,
      source: alert.source,
      occurrences: alert.occurrences,
      startsAt: alert.startsAt.toISOString(),
      lastSeenAt: alert.lastSeenAt.toISOString(),
    })),
    ...(incident.deploymentId === undefined ? {} : { deployment: { id: incident.deploymentId } }),
  };
}

export function incidentAnalysisResponse(value: IncidentAnalysisDocument) {
  return {
    id: value.id,
    organizationId: value.organizationId.toString(),
    incidentId: value.incidentId.toString(),
    generatedAt: value.generatedAt,
    analysis: value.analysis,
    provider: value.provider,
    model: value.model,
    createdAt: value.createdAt,
  };
}

export async function latestIncidentAnalysis(organizationId: string, incidentId: string) {
  return IncidentAnalysisModel.findOne({ organizationId: objectId(organizationId), incidentId: objectId(incidentId) }).sort({ generatedAt: -1 }).exec();
}

export async function incidentAnalysisHistory(organizationId: string, incidentId: string) {
  return IncidentAnalysisModel.find({ organizationId: objectId(organizationId), incidentId: objectId(incidentId) }).sort({ generatedAt: -1 }).limit(20).exec();
}

export async function persistIncidentAnalysis(
  organizationId: string,
  incidentId: string,
  analysis: IncidentAnalysis,
  provider: string,
  modelName: string,
) {
  await buildIncidentAnalysisContext(organizationId, incidentId);
  return IncidentAnalysisModel.create({
    organizationId: objectId(organizationId),
    incidentId: objectId(incidentId),
    generatedAt: new Date(),
    analysis,
    provider,
    model: modelName,
  });
}

export async function processIncidentAnalysis(
  organizationId: string,
  incidentId: string,
  provider: IncidentAnalysisProvider = createIncidentAnalysisProvider(),
) {
  const context = await buildIncidentAnalysisContext(organizationId, incidentId);
  const analysis = validateIncidentAnalysis(await provider.analyzeIncident(context));
  return IncidentAnalysisModel.create({
    organizationId: objectId(organizationId),
    incidentId: objectId(incidentId),
    generatedAt: new Date(),
    analysis,
    provider: provider.name,
    model: provider.model,
  });
}
