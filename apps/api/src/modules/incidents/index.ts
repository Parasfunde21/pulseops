import { model, Schema, type HydratedDocument, type Types } from 'mongoose';

export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
export type IncidentStatus = 'triggered' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';
export type IncidentTimelineEventType =
  | 'incident created'
  | 'incident acknowledged'
  | 'severity changed'
  | 'assignee changed'
  | 'comment added'
  | 'status changed'
  | 'incident resolved'
  | 'incident reopened';

export interface IncidentTimelineEvent {
  type: IncidentTimelineEventType;
  actor: Types.ObjectId;
  timestamp: Date;
  details?: string;
}

export interface Incident {
  organizationId: Types.ObjectId;
  serviceId: Types.ObjectId;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  priority: IncidentPriority;
  createdBy: Types.ObjectId;
  assignedTo?: Types.ObjectId | null;
  startedAt: Date;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  resolvedBy?: Types.ObjectId | null;
  source: string;
  alertIds?: Types.ObjectId[];
  deploymentId?: string;
  timeline: IncidentTimelineEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export type IncidentDocument = HydratedDocument<Incident>;

const timelineSchema = new Schema<IncidentTimelineEvent>(
  {
    type: { type: String, required: true },
    actor: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    timestamp: { type: Date, required: true },
    details: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const incidentSchema = new Schema<Incident>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization' },
    serviceId: { type: Schema.Types.ObjectId, required: true, ref: 'Service' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 10000 },
    severity: { type: String, required: true, enum: ['SEV1', 'SEV2', 'SEV3', 'SEV4'] },
    status: { type: String, required: true, default: 'triggered', enum: ['triggered', 'investigating', 'identified', 'monitoring', 'resolved'] },
    priority: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'] },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startedAt: { type: Date, required: true },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, required: true, trim: true, maxlength: 80 },
    alertIds: { type: [Schema.Types.ObjectId], ref: 'Alert', default: undefined },
    deploymentId: { type: String, trim: true, maxlength: 120 },
    timeline: { type: [timelineSchema], required: true, default: [] },
  },
  { timestamps: true },
);

incidentSchema.index({ organizationId: 1, status: 1 });
incidentSchema.index({ organizationId: 1, severity: 1 });
incidentSchema.index({ organizationId: 1, serviceId: 1 });

export const IncidentModel = model<Incident>('Incident', incidentSchema);/** Incidents module boundary; intentionally unimplemented in Milestone 1. */
export {};
