import { Router } from 'express';

import { authRouter } from '../modules/auth/index.js';
import { healthRouter } from './health.js';

const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);

export { apiRouter };
