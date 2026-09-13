import { Router } from 'express';

import { requireAuthentication } from '../../middleware/auth.js';
import { requireOrganizationContext } from '../../middleware/organization-context.js';
import { requireRole } from '../../middleware/rbac.js';
import { acknowledge, create, get, list, reopen, resolve, update } from './controller.js';

const incidentsRouter: Router = Router({ mergeParams: true });

incidentsRouter.use(requireAuthentication, requireOrganizationContext);
incidentsRouter.get('/', list);
incidentsRouter.get('/:incidentId', get);
incidentsRouter.post('/', requireRole('admin'), create);
incidentsRouter.patch('/:incidentId', requireRole('admin'), update);
incidentsRouter.post('/:incidentId/acknowledge', requireRole('admin'), acknowledge);
incidentsRouter.post('/:incidentId/resolve', requireRole('admin'), resolve);
incidentsRouter.post('/:incidentId/reopen', requireRole('admin'), reopen);

export { incidentsRouter };