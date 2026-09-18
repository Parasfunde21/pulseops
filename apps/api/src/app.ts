import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { ErrorRequestHandler } from 'express';

import { notFound } from './middleware/not-found.js';
import { apiRouter } from './routes/index.js';

const handleError: ErrorRequestHandler = (...args) => {
  const response = args[2];
  response.status(500).json({ error: 'Internal server error.' });
};

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use('/webhooks', express.raw({ type: '*/*', limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(apiRouter);
  app.use(notFound);
  app.use(handleError);

  return app;
}
