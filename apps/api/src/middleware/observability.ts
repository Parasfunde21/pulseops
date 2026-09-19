import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

import { logger } from '@pulseops/logger';

import { recordHttpRequest } from '../observability/metrics.js';

export const observabilityMiddleware: RequestHandler = (request, response, next) => {
  const suppliedId = request.get('x-request-id');
  const requestId = suppliedId?.trim() || randomUUID();
  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const route = typeof request.route?.path === 'string' ? request.route.path : 'unmatched';
    recordHttpRequest(request.method, route, response.statusCode, durationSeconds);
    if (route !== '/health' && route !== '/metrics') {
      logger.info('HTTP request completed', {
        method: request.method,
        path: request.path,
        route,
        status: response.statusCode,
        durationMs: Math.round(durationSeconds * 1000),
        requestId,
      });
    }
  });

  next();
};