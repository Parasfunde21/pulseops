import { model, Schema, type HydratedDocument, type Types } from 'mongoose';

export type AlertSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
export type AlertStatus = 'firing' | 'resolved';

export interface Alert {
	organizationId: Types.ObjectId;
	serviceId: Types.ObjectId;
	fingerprint: string;
	name: string;
	summary?: string;
	description?: string;
	severity: AlertSeverity;
	status: AlertStatus;
	source: string;
	labels?: Record<string, string>;
	annotations?: Record<string, string>;
	startsAt: Date;
	endsAt?: Date;
	lastSeenAt: Date;
	occurrences: number;
	incidentId?: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

export type AlertDocument = HydratedDocument<Alert>;

const alertSchema = new Schema<Alert>(
	{
		organizationId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization' },
		serviceId: { type: Schema.Types.ObjectId, required: true, ref: 'Service' },
		fingerprint: { type: String, required: true, trim: true, lowercase: true, maxlength: 500 },
		name: { type: String, required: true, trim: true, maxlength: 200 },
		summary: { type: String, trim: true, maxlength: 2000 },
		description: { type: String, trim: true, maxlength: 10000 },
		severity: { type: String, required: true, enum: ['SEV1', 'SEV2', 'SEV3', 'SEV4'] },
		status: { type: String, required: true, enum: ['firing', 'resolved'] },
		source: { type: String, required: true, trim: true, maxlength: 80 },
		labels: { type: Map, of: String },
		annotations: { type: Map, of: String },
		startsAt: { type: Date, required: true },
		endsAt: { type: Date },
		lastSeenAt: { type: Date, required: true },
		occurrences: { type: Number, required: true, min: 1, default: 1 },
		incidentId: { type: Schema.Types.ObjectId, ref: 'Incident' },
	},
	{ timestamps: true },
);

alertSchema.index({ organizationId: 1, fingerprint: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'firing' } });
alertSchema.index({ organizationId: 1, serviceId: 1 });
alertSchema.index({ organizationId: 1, status: 1 });
alertSchema.index({ organizationId: 1, lastSeenAt: -1 });

export const AlertModel = model<Alert>('Alert', alertSchema);
