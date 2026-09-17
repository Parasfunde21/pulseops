import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';

import type { AlertSeverity, AlertStatus } from './index.js';
import {
  alertForOrganization, alertResponse, alertsForOrganization, AlertAlreadyResolvedError, AlertServiceNotFoundError,
  ingestFiring, resolveByFingerprint, resolveById, type AlertEventInput,
} from './service.js';

const severities: AlertSeverity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4'];
const statuses: AlertStatus[] = ['firing', 'resolved'];

type Body = Record<string, unknown>;
function record(value: unknown): Body | null { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Body : null; }
function stringValue(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}
function optionalString(value: unknown, maximum: number): string | undefined | null {
  if (value === undefined) return undefined;
  return stringValue(value, maximum);
}
function dateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function mapValue(value: unknown): Record<string, string> | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.length === 0 || key.length > 100 || typeof entry !== 'string' || entry.length > 1000) return null;
    result[key] = entry;
  }
  return result;
}
function invalid(response: Parameters<RequestHandler>[1]): void { response.status(400).json({ error: 'Invalid alert data.' }); }
function notFound(response: Parameters<RequestHandler>[1]): void { response.status(404).json({ error: 'Alert not found.' }); }
function alertId(request: Parameters<RequestHandler>[0]): string | null {
  const value = request.params.alertId;
  return typeof value === 'string' && isValidObjectId(value) ? value : null;
}

function parseInput(value: unknown, eventType?: AlertStatus): AlertEventInput & { status: AlertStatus } | null {
  const body = record(value);
  if (body === null) return null;
  const allowed = new Set(['serviceId', 'fingerprint', 'name', 'summary', 'description', 'severity', 'source', 'labels', 'annotations', 'startsAt', 'endsAt', ...(eventType === undefined ? ['status'] : [])]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return null;
  const serviceId = stringValue(body.serviceId, 100);
  const fingerprint = stringValue(body.fingerprint, 500);
  const name = stringValue(body.name, 200);
  const summary = optionalString(body.summary, 2000);
  const description = optionalString(body.description, 10000);
  const source = stringValue(body.source, 80);
  const labels = mapValue(body.labels);
  const annotations = mapValue(body.annotations);
  const startsAt = dateValue(body.startsAt);
  const endsAt = body.endsAt === undefined ? undefined : dateValue(body.endsAt);
  const severity = body.severity;
  const statusValue = eventType ?? (body.status === undefined ? 'firing' : body.status);
  if (serviceId === null || fingerprint === null || name === null || source === null || startsAt === null || summary === null || description === null || labels === null || annotations === null || endsAt === null) return null;
  if (typeof severity !== 'string' || !severities.includes(severity as AlertSeverity) || typeof statusValue !== 'string' || !statuses.includes(statusValue as AlertStatus)) return null;
  if (endsAt !== undefined && endsAt.getTime() < startsAt.getTime()) return null;
  return {
    serviceId, fingerprint, name,
    ...(summary === undefined ? {} : { summary }),
    ...(description === undefined ? {} : { description }),
    severity: severity as AlertSeverity,
    source,
    ...(labels === undefined ? {} : { labels }),
    ...(annotations === undefined ? {} : { annotations }),
    startsAt,
    ...(endsAt === undefined ? {} : { endsAt }),
    status: statusValue as AlertStatus,
  };
}

async function processInput(request: Parameters<RequestHandler>[0], input: AlertEventInput & { status: AlertStatus }) {
  return input.status === 'resolved'
    ? resolveByFingerprint(request.organization!.organizationId, request.auth!.userId, input)
    : ingestFiring(request.organization!.organizationId, request.auth!.userId, input);
}

export const create: RequestHandler = async (request, response, next) => {
  const input = parseInput(request.body);
  if (input === null) return invalid(response);
  try {
    response.status(input.status === 'firing' ? 201 : 200).json({ alert: alertResponse(await processInput(request, input)) });
  } catch (error) {
    if (error instanceof AlertServiceNotFoundError) return notFound(response);
    next(error);
  }
};

export const event: RequestHandler = async (request, response, next) => {
  const body = record(request.body);
  const type = body?.type;
  if (type !== 'firing' && type !== 'resolved') return invalid(response);
  const payload = { ...(body ?? {}) };
  delete payload.type;
  const input = parseInput(payload, type);
  if (input === null) return invalid(response);
  try {
    response.status(200).json({ alert: alertResponse(await processInput(request, input)) });
  } catch (error) {
    if (error instanceof AlertServiceNotFoundError) return notFound(response);
    next(error);
  }
};

export const list: RequestHandler = async (request, response, next) => {
  const filters = Object.fromEntries(['status', 'severity', 'serviceId', 'source'].filter((key) => request.query[key] !== undefined).map((key) => [key, request.query[key]])) as Record<string, string>;
  if (filters.status !== undefined && !statuses.includes(filters.status as AlertStatus)) return invalid(response);
  if (filters.severity !== undefined && !severities.includes(filters.severity as AlertSeverity)) return invalid(response);
  if (filters.serviceId !== undefined && !isValidObjectId(filters.serviceId)) return invalid(response);
  if (filters.source !== undefined && stringValue(filters.source, 80) === null) return invalid(response);
  try { response.status(200).json({ alerts: (await alertsForOrganization(request.organization!.organizationId, filters)).map(alertResponse) }); }
  catch (error) { next(error); }
};

export const get: RequestHandler = async (request, response, next) => {
  if (alertId(request) === null) return notFound(response);
  try {
    const alert = await alertForOrganization(request.organization!.organizationId, alertId(request)!);
    if (alert === null) return notFound(response);
    response.status(200).json({ alert: alertResponse(alert) });
  } catch (error) { next(error); }
};

export const resolve: RequestHandler = async (request, response, next) => {
  if (alertId(request) === null) return notFound(response);
  const body = record(request.body);
  if (body !== null && Object.keys(body).some((key) => key !== 'endsAt')) return invalid(response);
  const endsAt = body?.endsAt === undefined ? new Date() : dateValue(body.endsAt);
  if (endsAt === null) return invalid(response);
  try { response.status(200).json({ alert: alertResponse(await resolveById(request.organization!.organizationId, request.auth!.userId, alertId(request)!, endsAt)) }); }
  catch (error) {
    if (error instanceof AlertServiceNotFoundError) return notFound(response);
    if (error instanceof AlertAlreadyResolvedError) return response.status(400).json({ error: 'Alert is already resolved.' });
    next(error);
  }
};
