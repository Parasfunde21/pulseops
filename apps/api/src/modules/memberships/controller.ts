import type { RequestHandler } from 'express';
import { isValidObjectId, Types } from 'mongoose';

import { UserModel } from '../users/index.js';
import { OrganizationMembershipModel } from './index.js';
import type { OrganizationRole } from '../../types/index.js';

const validRoles: OrganizationRole[] = ['owner', 'admin', 'member'];

function body(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function membershipResponse(membership: { userId: Types.ObjectId; role: OrganizationRole; createdAt: Date; updatedAt: Date }) {
  return { userId: membership.userId.toString(), role: membership.role, createdAt: membership.createdAt, updatedAt: membership.updatedAt };
}
function canManage(requestRole: OrganizationRole, targetRole: OrganizationRole): boolean {
  return requestRole === 'owner' || (requestRole === 'admin' && targetRole !== 'owner');
}

export const listMembers: RequestHandler = async (request, response, next) => {
  try {
    const memberships = await OrganizationMembershipModel.find({ organizationId: new Types.ObjectId(request.organization!.organizationId) }).exec();
    response.status(200).json({ members: memberships.map(membershipResponse) });
  } catch (error) { next(error); }
};

export const addMember: RequestHandler = async (request, response, next) => {
  const input = body(request.body);
  const requestedRole = input?.role;
  const role: OrganizationRole = requestedRole === undefined ? 'member' : requestedRole as OrganizationRole;
  if (!validRoles.includes(role) || role === 'owner') return void response.status(400).json({ error: 'Invalid membership role.' });
  if (request.organization!.role === 'admin' && role !== 'member') return void response.status(403).json({ error: 'Forbidden' });
  try {
    let userId = typeof input?.userId === 'string' ? input.userId : undefined;
    if (userId === undefined && typeof input?.email === 'string') {
      const user = await UserModel.findOne({ email: input.email.trim().toLowerCase() }).exec();
      userId = user?.id;
    }
    if (userId === undefined || !isValidObjectId(userId)) return void response.status(400).json({ error: 'A valid userId or email is required.' });
    if (await UserModel.exists({ _id: userId }) === null) return void response.status(404).json({ error: 'User not found.' });
    const membership = await OrganizationMembershipModel.create({ organizationId: new Types.ObjectId(request.organization!.organizationId), userId: new Types.ObjectId(userId), role });
    response.status(201).json({ membership: membershipResponse(membership) });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) return void response.status(409).json({ error: 'User is already a member.' });
    next(error);
  }
};

export const updateMember: RequestHandler = async (request, response, next) => {
  const role = body(request.body)?.role;
  if (typeof role !== 'string' || !validRoles.includes(role as OrganizationRole)) return void response.status(400).json({ error: 'Invalid membership role.' });
  try {
    const userId = typeof request.params.userId === 'string' ? request.params.userId : undefined;
    if (userId === undefined || !isValidObjectId(userId)) return void response.status(404).json({ error: 'Member not found.' });
    const membership = await OrganizationMembershipModel.findOne({ organizationId: new Types.ObjectId(request.organization!.organizationId), userId: new Types.ObjectId(userId) }).exec();
    if (membership === null) return void response.status(404).json({ error: 'Member not found.' });
    if (!canManage(request.organization!.role, membership.role)) return void response.status(403).json({ error: 'Forbidden' });
    if (membership.role === 'owner' || role === 'owner') return void response.status(400).json({ error: 'Ownership changes require a dedicated transfer flow.' });
    if (request.organization!.role === 'admin' && role !== 'member') return void response.status(403).json({ error: 'Forbidden' });
    membership.role = role as OrganizationRole;
    await membership.save();
    response.status(200).json({ membership: membershipResponse(membership) });
  } catch (error) { next(error); }
};

export const removeMember: RequestHandler = async (request, response, next) => {
  try {
    const userId = typeof request.params.userId === 'string' ? request.params.userId : undefined;
    if (userId === undefined || !isValidObjectId(userId)) return void response.status(404).json({ error: 'Member not found.' });
    const membership = await OrganizationMembershipModel.findOne({ organizationId: new Types.ObjectId(request.organization!.organizationId), userId: new Types.ObjectId(userId) }).exec();
    if (membership === null) return void response.status(404).json({ error: 'Member not found.' });
    if (!canManage(request.organization!.role, membership.role)) return void response.status(403).json({ error: 'Forbidden' });
    if (membership.role === 'owner') return void response.status(400).json({ error: 'Organization owners cannot be removed through this endpoint.' });
    await membership.deleteOne();
    response.status(204).send();
  } catch (error) { next(error); }
};
