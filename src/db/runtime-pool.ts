import { Pool } from 'pg';

import { requiredEnv } from '../config/env';

const globalPool = globalThis as typeof globalThis & { mhooCorePool?: Pool };

export function getCoreRuntimePool(): Pool {
  if (!globalPool.mhooCorePool) {
    globalPool.mhooCorePool = new Pool({
      connectionString: requiredEnv('DATABASE_URL'),
      max: Number(process.env.DATABASE_POOL_MAX ?? '10'),
    });
  }

  return globalPool.mhooCorePool;
}
