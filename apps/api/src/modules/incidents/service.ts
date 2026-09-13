import { Types } from 'mongoose';

import { ServiceModel } from '../services/index.js';
import { IncidentModel, type IncidentDocument, type IncidentPriority, type IncidentSeverity, type IncidentStatus, type IncidentTimelineEventType } from './index.js';

export interface IncidentInput {
  serviceId: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  priority: IncidentPriority;
  source: string;
  assignedTo?: string | null;
  startedAt: Date;
}

export type IncidentUpdateInput = Partial<Omit<IncidentInput, 'startedAt'>> & { status?: IncidentStatus };

export class IncidentServiceNotFoundError extends Error {}
export class InvalidIncidentTransitionError extends Error {}

const transitions: Record<IncidentStatus, IncidentStatus[]> = {
  triggered: ['investigating'],
  investigating: ['identified', 'resolved'],
  identified: ['monitoring', 'resolved'],
  monitoring: ['resolved'],
  resolved: ['investigating'],
};

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function timelineEvent(type: IncidentTimelineEventType, actor: string, details?: string) {
  return { type, actor: objectId(actor), timestamp: new Date(), ...(details === undefined ? {} : { details }) };
}

function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return transitions[from].includes(to);
}

export function incidentResponse(incident: IncidentDocument) {
  return {
    id: incident.id,
    organizationId: incident.organizationId.toString(),
    serviceId: incident.serviceId.toString(),
    title: incident.title,
    ...(incident.description === undefined ? {} : { description: incident.description }),
    severity: incident.severity,
    status: incident.status,
    priority: incident.priority,
    createdBy: incident.createdBy.toString(),
    ...(incident.assignedTo == null ? {} : { assignedTo: incident.assignedTo.toString() }),
    startedAt: incident.startedAt,
    ...(incident.acknowledgedAt == null ? {} : { acknowledgedAt: incident.acknowledgedAt }),
    ...(incident.resolvedAt == null ? {} : { resolvedAt: incident.resolvedAt }),
    ...(incident.resolvedBy == null ? {} : { resolvedBy: incident.resolvedBy.toString() }),
    source: incident.source,
    ...(incident.alertIds === undefined ? {} : { alertIds: incident.alertIds.map((id) => id.toString()) }),
    ...(incident.deploymentId === undefined ? {} : { deploymentId: incident.deploymentId }),
    timeline: incident.timeline.map((event) => ({
      type: event.type,
      actor: event.actor.toString(),
      timestamp: event.timestamp,
      ...(event.details === undefined ? {} : { details: event.details }),
    })),
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  };
}

export async function createIncident(organizationId: string, userId: string, input: IncidentInput) {
  const service = await ServiceModel.findOne({ _id: objectId(input.serviceId), organizationId: objectId(organizationId) }).select('_id').exec();
  if (service === null) throw new IncidentServiceNotFoundError();
  return IncidentModel.create({
    organizationId: objectId(organizationId),
    createdBy: objectId(userId),
    ...input,
    serviceId: objectId(input.serviceId),
    ...(input.assignedTo === undefined || input.assignedTo === null ? { assignedTo: null } : { assignedTo: objectId(input.assignedTo) }),
    status: 'triggered',
    timeline: [timelineEvent('incident created', userId)],
  });
}

export async function incidentsForOrganization(organizationId: string, filters: Partial<Record<'status' | 'severity' | 'serviceId' | 'priority', string>>) {
  const query: Record<string, unknown> = { organizationId: objectId(organizationId) };
  for (const key of ['status', 'severity', 'priority'] as const) if (filters[key] !== undefined) query[key] = filters[key];
  if (filters.serviceId !== undefined) query.serviceId = objectId(filters.serviceId);
  return IncidentModel.find(query).sort({ startedAt: -1 }).exec();
}

export function incidentForOrganization(organizationId: string, incidentId: string) {
  return IncidentModel.findOne({ _id: objectId(incidentId), organizationId: objectId(organizationId) }).exec();
}

export async function updateIncident(incident: IncidentDocument, actor: string, input: IncidentUpdateInput) {
  if (input.serviceId !== undefined) {
    const service = await ServiceModel.findOne({ _id: objectId(input.serviceId), organizationId: incident.organizationId }).select('_id').exec();
    if (service === null) throw new IncidentServiceNotFoundError();
    incident.serviceId = objectId(input.serviceId);
  }
  if (input.status !== undefined && input.status !== incident.status) {
    if (!canTransition(incident.status, input.status)) throw new InvalidIncidentTransitionError();
    incident.timeline.push(timelineEvent('status changed', actor, `${incident.status} -> ${input.status}`));
    incident.status = input.status;
    if (input.status === 'resolved') {
      incident.resolvedAt = new Date();
      incident.resolvedBy = objectId(actor);
    } else if (incident.status === 'investigating' && incident.resolvedAt !== null) {
      incident.resolvedAt = null;
      incident.resolvedBy = null;
    }
  }
  if (input.severity !== undefined && input.severity !== incident.severity) {
    incident.timeline.push(timelineEvent('severity changed', actor, `${incident.severity} -> ${input.severity}`));
    incident.severity = input.severity;
  }
  if (input.assignedTo !== undefined) {
    const previous = incident.assignedTo?.toString() ?? null;
    const next = input.assignedTo;
    if (previous !== next) incident.timeline.push(timelineEvent('assignee changed', actor, next === null ? 'unassigned' : next));
    incident.assignedTo = next === null ? null : objectId(next);
  }
  if (input.title !== undefined) incident.title = input.title;
  if (input.description !== undefined) incident.description = input.description;
  if (input.priority !== undefined) incident.priority = input.priority;
  if (input.source !== undefined) incident.source = input.source;
  return incident.save();
}

export async function acknowledgeIncident(incident: IncidentDocument, actor: string) {
  if (incident.status === 'resolved' || (incident.status !== 'triggered' && incident.acknowledgedAt !== null)) throw new InvalidIncidentTransitionError();
  if (incident.status === 'triggered') incident.status = 'investigating';
  incident.acknowledgedAt = new Date();
  incident.timeline.push(timelineEvent('incident acknowledged', actor));
  return incident.save();
}

export async function resolveIncident(incident: IncidentDocument, actor: string) {
  if (incident.status === 'resolved' || !canTransition(incident.status, 'resolved')) throw new InvalidIncidentTransitionError();
  incident.status = 'resolved';
  incident.resolvedAt = new Date();
  incident.resolvedBy = objectId(actor);
  incident.timeline.push(timelineEvent('incident resolved', actor));
  return incident.save();
}

export async function reopenIncident(incident: IncidentDocument, actor: string) {
  if (incident.status !== 'resolved') throw new InvalidIncidentTransitionError();
  incident.status = 'investigating';
  incident.resolvedAt = null;
  incident.resolvedBy = null;
  incident.timeline.push(timelineEvent('incident reopened', actor));
  return incident.save();
}