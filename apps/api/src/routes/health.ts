import { Router } from 'express';

import { isDatabaseReachable } from '../config/database.js';

const healthRouter: Router = Router();

healthRouter.get('/', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'pulseops-api',
  });
});

healthRouter.get('/db', async (_request, response) => {
  const reachable = await isDatabaseReachable();

  if (!reachable) {
    response.status(503).json({
      status: 'unavailable',
      service: 'pulseops-api',
      database: 'unavailable',
    });
    return;
  }

  response.status(200).json({
    status: 'ok',
    service: 'pulseops-api',
    database: 'reachable',
  });
});

export { healthRouter };
