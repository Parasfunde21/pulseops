import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';

import { jobsQueue } from '../jobs/queue.js';
import { recordJobQueued } from '../../observability/metrics.js';
import { incidentAiAnalysisJobName, type IncidentAiAnalysisJobData } from '../jobs/types.js';
import { incidentAnalysisHistory, incidentAnalysisResponse, latestIncidentAnalysis } from './analysis.js';
import type { IncidentDocument, IncidentPriority, IncidentSeverity, IncidentStatus } from './index.js';
import {
  acknowledgeIncident, createIncident, incidentForOrganization, incidentResponse, incidentsForOrganization,
  IncidentServiceNotFoundError, InvalidIncidentTransitionError, reopenIncident, resolveIncident, updateIncident,
  type IncidentInput, type IncidentUpdateInput,
} from './service.js';

const severities: IncidentSeverity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4'];
const priorities: IncidentPriority[] = ['low', 'medium', 'high', 'critical'];
const statuses: IncidentStatus[] = ['triggered', 'investigating', 'identified', 'monitoring', 'resolved'];

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function stringValue(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}
function optionalString(value: unknown, maximum: number): string | undefined | null {
  if (value === undefined) return undefined;
  return stringValue(value, maximum);
}
function objectIdValue(value: unknown, nullable = false): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null && nullable) return null;
  return typeof value === 'string' && isValidObjectId(value) ? value : null;
}
function dateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseInput(value: unknown, creating: boolean): IncidentInput | IncidentUpdateInput | null {
  const body = record(value);
  if (body === null) return null;
  const allowed = new Set(['serviceId', 'title', 'description', 'severity', 'priority', 'source', 'assignedTo', 'startedAt', 'status']);
  if (Object.keys(body).some((key) => !allowed.has(key)) || (!creating && Object.keys(body).length === 0)) return null;
  const serviceId = objectIdValue(body.serviceId);
  const title = optionalString(body.title, 200);
  const description = optionalString(body.description, 10000);
  const source = optionalString(body.source, 80);
  const assignedTo = objectIdValue(body.assignedTo, true);
  if (serviceId === null || (creating && serviceId === undefined) || (title === null || (creating && title === undefined)) || description === null || source === null || (creating && (source === undefined || source === null)) || assignedTo === null) return null;
  const severity = body.severity;
  const priority = body.priority;
  const status = body.status;
  if ((creating && (typeof severity !== 'string' || !severities.includes(severity as IncidentSeverity))) || (severity !== undefined && (typeof severity !== 'string' || !severities.includes(severity as IncidentSeverity)))) return null;
  if ((creating && (typeof priority !== 'string' || !priorities.includes(priority as IncidentPriority))) || (priority !== undefined && (typeof priority !== 'string' || !priorities.includes(priority as IncidentPriority)))) return null;
  if (status !== undefined && (typeof status !== 'string' || !statuses.includes(status as IncidentStatus))) return null;
  const startedAt = body.startedAt === undefined ? (creating ? new Date() : undefined) : dateValue(body.startedAt);
  if (startedAt === null) return null;
  return {
    ...(serviceId === undefined ? {} : { serviceId }), ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }), ...(source === undefined ? {} : { source }),
    ...(assignedTo === undefined ? {} : { assignedTo }), ...(startedAt === undefined ? {} : { startedAt }),
    ...(severity === undefined ? {} : { severity: severity as IncidentSeverity }),
    ...(priority === undefined ? {} : { priority: priority as IncidentPriority }),
    ...(status === undefined ? {} : { status: status as IncidentStatus }),
  } as IncidentInput | IncidentUpdateInput;
}

function incidentId(request: Parameters<RequestHandler>[0]): string | null {
  const value = request.params.incidentId;
  return typeof value === 'string' && isValidObjectId(value) ? value : null;
}
function notFound(response: Parameters<RequestHandler>[1]): void { response.status(404).json({ error: 'Incident not found.' }); }
function invalid(response: Parameters<RequestHandler>[1]): void { response.status(400).json({ error: 'Invalid incident data.' }); }

async function load(request: Parameters<RequestHandler>[0]) {
  const id = incidentId(request);
  return id === null ? null : incidentForOrganization(request.organization!.organizationId, id);
}

export const create: RequestHandler = async (request, response, next) => {
  const input = parseInput(request.body, true);
  if (input === null) return invalid(response);
  try { response.status(201).json({ incident: incidentResponse(await createIncident(request.organization!.organizationId, request.auth!.userId, input as IncidentInput)) }); }
  catch (error) { if (error instanceof IncidentServiceNotFoundError) return notFound(response); next(error); }
};

export const list: RequestHandler = async (request, response, next) => {
  try {
    const filters = Object.fromEntries(['status', 'severity', 'serviceId', 'priority'].filter((key) => request.query[key] !== undefined).map((key) => [key, request.query[key]])) as Record<string, string>;
    if (filters.status !== undefined && !statuses.includes(filters.status as IncidentStatus)) return invalid(response);
    if (filters.severity !== undefined && !severities.includes(filters.severity as IncidentSeverity)) return invalid(response);
    if (filters.priority !== undefined && !priorities.includes(filters.priority as IncidentPriority)) return invalid(response);
    if (filters.serviceId !== undefined && !isValidObjectId(filters.serviceId)) return invalid(response);
    response.status(200).json({ incidents: (await incidentsForOrganization(request.organization!.organizationId, filters)).map(incidentResponse) });
  } catch (error) { next(error); }
};

export const get: RequestHandler = async (request, response, next) => {
  if (incidentId(request) === null) return notFound(response);
  try { const incident = await load(request); if (incident === null) return notFound(response); response.status(200).json({ incident: incidentResponse(incident) }); }
  catch (error) { next(error); }
};

export const getAnalysis: RequestHandler = async (request, response, next) => {
  if (incidentId(request) === null) return notFound(response);
  try {
    const incident = await load(request);
    if (incident === null) return notFound(response);
    const [latest, history] = await Promise.all([
      latestIncidentAnalysis(request.organization!.organizationId, incident.id),
      incidentAnalysisHistory(request.organization!.organizationId, incident.id),
    ]);
    response.status(200).json({
      analysis: latest === null ? null : incidentAnalysisResponse(latest),
      history: history.map(incidentAnalysisResponse),
    });
  } catch (error) { next(error); }
};

export const requestAnalysis: RequestHandler = async (request, response, next) => {
  if (incidentId(request) === null) return notFound(response);
  try {
    const incident = await load(request);
    if (incident === null) return notFound(response);
    const data: IncidentAiAnalysisJobData = {
      organizationId: request.organization!.organizationId,
      incidentId: incident.id,
      requestedAt: new Date().toISOString(),
    };
    const job = await jobsQueue.add(incidentAiAnalysisJobName, data);
    recordJobQueued(incidentAiAnalysisJobName);
    response.status(202).json({ message: 'Incident analysis queued', jobId: job.id, incidentId: incident.id });
  } catch (error) { next(error); }
};

export const update: RequestHandler = async (request, response, next) => {
  const input = parseInput(request.body, false);
  if (incidentId(request) === null) return notFound(response);
  if (input === null) return invalid(response);
  try {
    const incident = await load(request); if (incident === null) return notFound(response);
    response.status(200).json({ incident: incidentResponse(await updateIncident(incident, request.auth!.userId, input as IncidentUpdateInput)) });
  } catch (error) {
    if (error instanceof IncidentServiceNotFoundError) return notFound(response);
    if (error instanceof InvalidIncidentTransitionError) return void response.status(400).json({ error: 'Invalid incident state transition.' });
    next(error);
  }
};

async function lifecycle(request: Parameters<RequestHandler>[0], response: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2], action: (incident: IncidentDocument, actor: string) => Promise<IncidentDocument>) {
  if (incidentId(request) === null) return notFound(response);
  try {
    const incident = await load(request); if (incident === null) return notFound(response);
    response.status(200).json({ incident: incidentResponse(await action(incident, request.auth!.userId)) });
  } catch (error) { if (error instanceof InvalidIncidentTransitionError) return void response.status(400).json({ error: 'Invalid incident state transition.' }); next(error); }
}

export const acknowledge: RequestHandler = (request, response, next) => lifecycle(request, response, next, acknowledgeIncident);
export const resolve: RequestHandler = (request, response, next) => lifecycle(request, response, next, resolveIncident);
export const reopen: RequestHandler = (request, response, next) => lifecycle(request, response, next, reopenIncident);