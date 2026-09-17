import { Types } from 'mongoose';

import { IncidentModel } from '../incidents/index.js';
import { createIncident, resolveIncident } from '../incidents/service.js';
import { ServiceModel } from '../services/index.js';
import { AlertModel, type AlertDocument, type AlertSeverity, type AlertStatus } from './index.js';

export interface AlertEventInput {
  serviceId: string;
  fingerprint: string;
  name: string;
  summary?: string;
  description?: string;
  severity: AlertSeverity;
  source: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt: Date;
  endsAt?: Date;
}

export class AlertServiceNotFoundError extends Error {}
export class AlertAlreadyResolvedError extends Error {}
export class InvalidAlertEventError extends Error {}

function objectId(value: string): Types.ObjectId { return new Types.ObjectId(value); }
function duplicateKey(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000; }
function mapResponse(value: Record<string, string> | undefined): Record<string, string> | undefined {
  return value instanceof Map ? Object.fromEntries(value.entries()) : value;
}

export function alertResponse(alert: AlertDocument) {
  return {
    id: alert.id,
    organizationId: alert.organizationId.toString(),
    serviceId: alert.serviceId.toString(),
    fingerprint: alert.fingerprint,
    name: alert.name,
    ...(alert.summary === undefined ? {} : { summary: alert.summary }),
    ...(alert.description === undefined ? {} : { description: alert.description }),
    severity: alert.severity,
    status: alert.status,
    source: alert.source,
    ...(alert.labels === undefined ? {} : { labels: mapResponse(alert.labels) }),
    ...(alert.annotations === undefined ? {} : { annotations: mapResponse(alert.annotations) }),
    startsAt: alert.startsAt,
    ...(alert.endsAt === undefined ? {} : { endsAt: alert.endsAt }),
    lastSeenAt: alert.lastSeenAt,
    occurrences: alert.occurrences,
    ...(alert.incidentId === undefined ? {} : { incidentId: alert.incidentId.toString() }),
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
  };
}

async function verifyService(organizationId: string, serviceId: string): Promise<void> {
  const service = await ServiceModel.findOne({ _id: objectId(serviceId), organizationId: objectId(organizationId) }).select('_id').exec();
  if (service === null) throw new AlertServiceNotFoundError();
}

function priorityFor(severity: AlertSeverity): 'low' | 'medium' | 'high' | 'critical' {
  return severity === 'SEV1' ? 'critical' : severity === 'SEV2' ? 'high' : severity === 'SEV3' ? 'medium' : 'low';
}

async function correlateIncident(organizationId: string, userId: string, alert: AlertDocument, input: AlertEventInput): Promise<void> {
  const activeIncident = await IncidentModel.findOne({
    organizationId: objectId(organizationId),
    serviceId: objectId(input.serviceId),
    source: 'alert',
    status: { $ne: 'resolved' },
  }).sort({ startedAt: -1 }).exec();

  const incident = activeIncident ?? await createIncident(organizationId, userId, {
    serviceId: input.serviceId,
    title: input.name,
    ...(input.description === undefined && input.summary === undefined ? {} : { description: input.description ?? input.summary }),
    severity: input.severity,
    priority: priorityFor(input.severity),
    source: 'alert',
    startedAt: input.startsAt,
  });

  await IncidentModel.updateOne(
    { _id: incident._id, organizationId: objectId(organizationId) },
    { $addToSet: { alertIds: alert._id } },
  ).exec();
  alert.incidentId = incident._id;
  await alert.save();
}

export async function ingestFiring(organizationId: string, userId: string, input: AlertEventInput): Promise<AlertDocument> {
  await verifyService(organizationId, input.serviceId);
  const tenant = objectId(organizationId);
  const fingerprint = input.fingerprint.trim().toLowerCase();
  const now = new Date();
  const existing = await AlertModel.findOneAndUpdate(
    { organizationId: tenant, fingerprint, status: 'firing' },
    {
      $set: {
        name: input.name,
        ...(input.summary === undefined ? {} : { summary: input.summary }),
        ...(input.description === undefined ? {} : { description: input.description }),
        severity: input.severity,
        source: input.source,
        ...(input.labels === undefined ? {} : { labels: input.labels }),
        ...(input.annotations === undefined ? {} : { annotations: input.annotations }),
        lastSeenAt: now,
      },
      $inc: { occurrences: 1 },
    },
    { new: true },
  ).exec();
  if (existing !== null) return existing;

  let alert: AlertDocument;
  try {
    alert = await AlertModel.create({
      organizationId: tenant,
      serviceId: objectId(input.serviceId),
      fingerprint,
      name: input.name,
      ...(input.summary === undefined ? {} : { summary: input.summary }),
      ...(input.description === undefined ? {} : { description: input.description }),
      severity: input.severity,
      status: 'firing',
      source: input.source,
      ...(input.labels === undefined ? {} : { labels: input.labels }),
      ...(input.annotations === undefined ? {} : { annotations: input.annotations }),
      startsAt: input.startsAt,
      lastSeenAt: now,
      occurrences: 1,
    });
  } catch (error) {
    if (!duplicateKey(error)) throw error;
    const concurrent = await AlertModel.findOneAndUpdate(
      { organizationId: tenant, fingerprint, status: 'firing' },
      { $set: { lastSeenAt: now }, $inc: { occurrences: 1 } },
      { new: true },
    ).exec();
    if (concurrent === null) throw error;
    return concurrent;
  }

  await correlateIncident(organizationId, userId, alert, input);
  return alert;
}

export async function resolveByFingerprint(organizationId: string, userId: string, input: AlertEventInput): Promise<AlertDocument> {
  await verifyService(organizationId, input.serviceId);
  const alert = await AlertModel.findOne({
    organizationId: objectId(organizationId),
    serviceId: objectId(input.serviceId),
    fingerprint: input.fingerprint.trim().toLowerCase(),
    status: 'firing',
  }).exec();
  if (alert === null) throw new AlertServiceNotFoundError();
  return resolveAlert(organizationId, userId, alert, input.endsAt ?? new Date());
}

export async function resolveAlert(organizationId: string, userId: string, alert: AlertDocument, endsAt: Date): Promise<AlertDocument> {
  if (alert.status !== 'firing') throw new AlertAlreadyResolvedError();
  alert.status = 'resolved';
  alert.endsAt = endsAt;
  alert.lastSeenAt = new Date();
  const resolved = await alert.save();
  if (resolved.incidentId !== undefined) {
    const remaining = await AlertModel.exists({ organizationId: objectId(organizationId), incidentId: resolved.incidentId, status: 'firing' });
    if (remaining === null) {
      const incident = await IncidentModel.findOne({ _id: resolved.incidentId, organizationId: objectId(organizationId) }).exec();
      if (incident !== null && ['investigating', 'identified', 'monitoring'].includes(incident.status)) await resolveIncident(incident, userId);
    }
  }
  return resolved;
}

export function alertForOrganization(organizationId: string, alertId: string) {
  return AlertModel.findOne({ _id: objectId(alertId), organizationId: objectId(organizationId) }).exec();
}

export async function alertsForOrganization(organizationId: string, filters: Partial<Record<'status' | 'severity' | 'serviceId' | 'source', string>>) {
  const query: Record<string, unknown> = { organizationId: objectId(organizationId) };
  for (const key of ['status', 'severity', 'source'] as const) if (filters[key] !== undefined) query[key] = filters[key];
  if (filters.serviceId !== undefined) query.serviceId = objectId(filters.serviceId);
  return AlertModel.find(query).sort({ lastSeenAt: -1 }).exec();
}

export async function resolveById(organizationId: string, userId: string, alertId: string, endsAt: Date) {
  const alert = await alertForOrganization(organizationId, alertId);
  if (alert === null) throw new AlertServiceNotFoundError();
  return resolveAlert(organizationId, userId, alert, endsAt);
}

export function statusOf(value: AlertStatus): AlertStatus { return value; }
