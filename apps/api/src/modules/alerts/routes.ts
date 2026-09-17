import { Router } from 'express';

import { requireAuthentication } from '../../middleware/auth.js';
import { requireOrganizationContext } from '../../middleware/organization-context.js';
import { requireRole } from '../../middleware/rbac.js';
import { create, event, get, list, resolve } from './controller.js';

const alertsRouter: Router = Router({ mergeParams: true });

alertsRouter.use(requireAuthentication, requireOrganizationContext);
alertsRouter.get('/', list);
alertsRouter.get('/:alertId', get);
alertsRouter.post('/', requireRole('admin'), create);
alertsRouter.post('/events', event);
alertsRouter.post('/:alertId/resolve', requireRole('admin'), resolve);

export { alertsRouter };
