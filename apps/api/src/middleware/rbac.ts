import type { RequestHandler } from 'express';

import type { OrganizationRole } from '../types/index.js';

const roleRank: Record<OrganizationRole, number> = { member: 1, admin: 2, owner: 3 };

/** Allows the specified role and more privileged organization roles. */
export function requireRole(minimumRole: OrganizationRole): RequestHandler {
  return (request, response, next) => {
    if (request.organization === undefined) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (roleRank[request.organization.role] < roleRank[minimumRole]) {
      response.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
