import { Router } from 'express';

import { isDatabaseReachable } from '../config/database.js';
import { isRedisReachable } from '../config/redis.js';
import { setReadiness } from '../observability/metrics.js';

export interface ReadinessDependencies {
  database: () => Promise<boolean>;
  redis: () => Promise<boolean>;
}

async function check(dependency: () => Promise<boolean>): Promise<boolean> {
  try {
    return await dependency();
  } catch {
    return false;
  }
}

export function createReadinessRouter(dependencies: ReadinessDependencies = {
  database: isDatabaseReachable,
  redis: isRedisReachable,
}): Router {
  const router = Router();
  router.get('/', async (_request, response) => {
    const [database, redis] = await Promise.all([
      check(dependencies.database),
      check(dependencies.redis),
    ]);
    const ready = database && redis;
    setReadiness(ready);
    response.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'unavailable',
      service: 'pulseops-api',
      dependencies: { mongodb: database ? 'reachable' : 'unavailable', redis: redis ? 'reachable' : 'unavailable' },
    });
  });
  return router;
}

export const readyRouter = createReadinessRouter();