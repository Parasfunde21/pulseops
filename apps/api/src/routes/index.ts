import { Router } from 'express';

import { authRouter } from '../modules/auth/index.js';
import { jobsRouter } from '../modules/jobs/routes.js';
import { organizationsRouter } from '../modules/organizations/routes.js';
import { healthRouter } from './health.js';
import { metricsRouter } from './metrics.js';
import { readyRouter } from './ready.js';
import { webhooksRouter } from './webhooks.js';

const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/ready', readyRouter);
apiRouter.use('/metrics', metricsRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/webhooks', webhooksRouter);
apiRouter.use('/organizations', organizationsRouter);
apiRouter.use('/jobs', jobsRouter);

export { apiRouter };
