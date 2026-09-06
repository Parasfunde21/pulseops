import type { RequestHandler } from 'express';
import { isValidObjectId, Types } from 'mongoose';

import { OrganizationMembershipModel } from '../modules/memberships/index.js';

function inaccessible(response: Parameters<RequestHandler>[1]): void {
  response.status(404).json({ error: 'Organization not found.' });
}

/** Resolves a tenant from the route or X-Organization-Id and verifies membership server-side. */
export const requireOrganizationContext: RequestHandler = async (request, response, next) => {
  if (request.auth === undefined) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const routeOrganizationId = typeof request.params.organizationId === 'string' ? request.params.organizationId : undefined;
  const headerOrganizationId = request.get('X-Organization-Id');
  const organizationId = headerOrganizationId ?? routeOrganizationId;

  if (
    organizationId === undefined ||
    !isValidObjectId(organizationId) ||
    (headerOrganizationId !== undefined && routeOrganizationId !== undefined && headerOrganizationId !== routeOrganizationId)
  ) {
    inaccessible(response);
    return;
  }

  try {
    const membership = await OrganizationMembershipModel.findOne({
      organizationId: new Types.ObjectId(organizationId),
      userId: new Types.ObjectId(request.auth.userId),
    }).exec();
    if (membership === null) {
      inaccessible(response);
      return;
    }

    request.organization = { organizationId, role: membership.role };
    next();
  } catch (error) {
    next(error);
  }
};
