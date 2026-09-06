import { Router } from 'express';

import { healthRouter } from './health.js';

const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);

export { apiRouter };
