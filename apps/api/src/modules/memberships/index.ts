import { model, Schema, type HydratedDocument, type Types } from 'mongoose';

import type { OrganizationRole } from '../../types/index.js';

export interface OrganizationMembership {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: OrganizationRole;
  createdAt: Date;
  updatedAt: Date;
}

export type OrganizationMembershipDocument = HydratedDocument<OrganizationMembership>;

const membershipSchema = new Schema<OrganizationMembership>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization' },
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    role: { type: String, required: true, enum: ['owner', 'admin', 'member'] },
  },
  { timestamps: true },
);

membershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1, organizationId: 1 });

export const OrganizationMembershipModel = model<OrganizationMembership>(
  'OrganizationMembership',
  membershipSchema,
);
