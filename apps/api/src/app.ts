import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { notFound } from './middleware/not-found.js';
import { apiRouter } from './routes/index.js';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(apiRouter);
  app.use(notFound);

  return app;
}
