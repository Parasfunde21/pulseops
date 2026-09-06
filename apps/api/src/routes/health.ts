import { Router } from 'express';

const healthRouter: Router = Router();

healthRouter.get('/', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'pulseops-api',
  });
});

export { healthRouter };
