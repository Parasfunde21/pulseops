import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { env } from '../config/env.js';
import type { AuthenticatedIdentity } from '../types/index.js';

function unauthorized(response: Parameters<RequestHandler>[1]): void {
  response.status(401).json({ error: 'Unauthorized' });
}

function identityFromPayload(payload: string | JwtPayload): AuthenticatedIdentity | null {
  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    return null;
  }

  const organizationId = payload.organizationId;
  if (organizationId !== undefined && typeof organizationId !== 'string') {
    return null;
  }

  return {
    userId: payload.sub,
    ...(organizationId === undefined ? {} : { organizationId }),
  };
}

export const requireAuthentication: RequestHandler = (request, response, next) => {
  const authorization = request.get('authorization');
  if (authorization === undefined) {
    unauthorized(response);
    return;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || token === undefined || token === '') {
    unauthorized(response);
    return;
  }

  try {
    const identity = identityFromPayload(jwt.verify(token, env.jwtSecret));
    if (identity === null) {
      unauthorized(response);
      return;
    }

    request.auth = identity;
    next();
  } catch {
    unauthorized(response);
  }
};
