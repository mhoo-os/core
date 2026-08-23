import { Pool } from 'pg';

import { requiredEnv } from '../config/env';

const pools = globalThis as typeof globalThis & { mhooCoreApiDataPool?: Pool };

/** The API-only pool. It is never used for pg-boss polling or worker data. */
export function getApiDataPool(): Pool {
  if (!pools.mhooCoreApiDataPool) {
    pools.mhooCoreApiDataPool = new Pool({
      connectionString: requiredEnv('CORE_API_DATABASE_URL', 'DATABASE_URL'),
      max: Number(process.env.CORE_API_DATA_POOL_MAX ?? '10'),
      application_name: 'mhoo-core-api-data',
    });
  }

  return pools.mhooCoreApiDataPool;
}

export type WorkerPools = {
  bossPool: Pool;
  workerDataPool: Pool;
};

/**
 * Each worker process creates these independent pools. Queue connections never
 * carry tenant context; business handlers always use `workerDataPool`.
 */
export function createWorkerPools(): WorkerPools {
  return {
    bossPool: new Pool({
      connectionString: requiredEnv('CORE_WORKER_BOSS_DATABASE_URL', 'DATABASE_URL'),
      max: Number(process.env.CORE_WORKER_BOSS_POOL_MAX ?? '4'),
      application_name: 'mhoo-core-worker-boss',
    }),
    workerDataPool: new Pool({
      connectionString: requiredEnv('CORE_WORKER_DATA_DATABASE_URL', 'DATABASE_URL'),
      max: Number(process.env.CORE_WORKER_DATA_POOL_MAX ?? '4'),
      application_name: 'mhoo-core-worker-data',
    }),
  };
}
