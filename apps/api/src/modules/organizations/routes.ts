import { Router } from 'express';

import { requireAuthentication } from '../../middleware/auth.js';
import { requireOrganizationContext } from '../../middleware/organization-context.js';
import { requireRole } from '../../middleware/rbac.js';
import { addMember, listMembers, removeMember, updateMember } from '../memberships/controller.js';
import { create, get, list } from './controller.js';

const organizationsRouter: Router = Router();

organizationsRouter.post('/', requireAuthentication, create);
organizationsRouter.get('/', requireAuthentication, list);

organizationsRouter.get('/:organizationId', requireAuthentication, requireOrganizationContext, get);
organizationsRouter.get('/:organizationId/members', requireAuthentication, requireOrganizationContext, listMembers);
organizationsRouter.post('/:organizationId/members', requireAuthentication, requireOrganizationContext, requireRole('admin'), addMember);
organizationsRouter.patch('/:organizationId/members/:userId', requireAuthentication, requireOrganizationContext, requireRole('admin'), updateMember);
organizationsRouter.delete('/:organizationId/members/:userId', requireAuthentication, requireOrganizationContext, requireRole('admin'), removeMember);

export { organizationsRouter };
