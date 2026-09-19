import { Router } from 'express';

import { renderMetrics } from '../observability/metrics.js';

export const metricsRouter = Router();

metricsRouter.get('/', (_request, response) => {
  response.type('text/plain').send(renderMetrics());
});