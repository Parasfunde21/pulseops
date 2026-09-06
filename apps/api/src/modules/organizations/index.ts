import { model, Schema, type HydratedDocument } from 'mongoose';

export interface Organization {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OrganizationDocument = HydratedDocument<Organization>;

const organizationSchema = new Schema<Organization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true },
);

organizationSchema.index({ slug: 1 }, { unique: true });

export const OrganizationModel = model<Organization>('Organization', organizationSchema);
