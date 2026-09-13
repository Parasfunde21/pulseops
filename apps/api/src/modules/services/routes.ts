import { Router } from 'express';

import { requireAuthentication } from '../../middleware/auth.js';
import { requireOrganizationContext } from '../../middleware/organization-context.js';
import { requireRole } from '../../middleware/rbac.js';
import { create, get, list, remove, update } from './controller.js';

const servicesRouter: Router = Router({ mergeParams: true });

servicesRouter.use(requireAuthentication, requireOrganizationContext);
servicesRouter.get('/', list);
servicesRouter.get('/:serviceId', get);
servicesRouter.post('/', requireRole('admin'), create);
servicesRouter.patch('/:serviceId', requireRole('admin'), update);
servicesRouter.delete('/:serviceId', requireRole('admin'), remove);

export { servicesRouter };
