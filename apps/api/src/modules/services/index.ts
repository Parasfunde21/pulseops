import { model, Schema, type HydratedDocument, type Types } from 'mongoose';

export type ServiceStatus = 'active' | 'inactive';

export interface Service {
  organizationId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  repositoryUrl?: string;
  environment?: string;
  teamName?: string;
  status: ServiceStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ServiceDocument = HydratedDocument<Service>;

const serviceSchema = new Schema<Service>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization' },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    repositoryUrl: { type: String, trim: true },
    environment: { type: String, trim: true },
    teamName: { type: String, trim: true },
    status: { type: String, required: true, default: 'active', enum: ['active', 'inactive'] },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: true },
);

serviceSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
serviceSchema.index({ organizationId: 1, status: 1 });

export const ServiceModel = model<Service>('Service', serviceSchema);
