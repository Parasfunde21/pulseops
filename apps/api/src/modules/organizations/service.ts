import { isValidObjectId, Types } from 'mongoose';

import { OrganizationMembershipModel } from '../memberships/index.js';
import { OrganizationModel, type OrganizationDocument } from './index.js';

export class SlugAlreadyExistsError extends Error {}

export function slugFromName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function organizationResponse(organization: OrganizationDocument) {
  return { id: organization.id, name: organization.name, slug: organization.slug, createdAt: organization.createdAt, updatedAt: organization.updatedAt };
}

export async function createOrganization(name: string, userId: string) {
  const slug = slugFromName(name);
  if (slug === '') return null;
  try {
    const organization = await OrganizationModel.create({ name, slug });
    try {
      await OrganizationMembershipModel.create({ organizationId: organization._id, userId: new Types.ObjectId(userId), role: 'owner' });
    } catch (error) {
      await OrganizationModel.deleteOne({ _id: organization.id }).exec();
      throw error;
    }
    return organization;
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new SlugAlreadyExistsError();
    throw error;
  }
}

export async function organizationsForUser(userId: string) {
  const memberships = await OrganizationMembershipModel.find({ userId: new Types.ObjectId(userId) }).select('organizationId').exec();
  const organizations = await OrganizationModel.find({
    _id: { $in: memberships.map((membership) => membership.organizationId) },
  }).exec();
  return organizations.map(organizationResponse);
}

export async function organizationById(organizationId: string) {
  return isValidObjectId(organizationId) ? OrganizationModel.findById(organizationId).exec() : null;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
