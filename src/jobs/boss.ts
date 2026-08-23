import { PgBoss } from 'pg-boss';
import type { Pool } from 'pg';

import { pgBossDatabase } from './pg-boss-db';

export const PHASE0B_MOCK_INGESTION_QUEUE = 'phase0b.mock-ingestion';
export const PHASE0B_DEAD_LETTER_QUEUE = 'phase0b.mock-ingestion-dead-letter';

export function createCoreBoss(bossPool: Pool, options: { supervise?: boolean } = {}): PgBoss {
  return new PgBoss({
    db: pgBossDatabase(bossPool),
    schema: 'pgboss',
    // Schema construction/upgrades are run only by core_migrator.
    migrate: false,
    createSchema: false,
    schedule: false,
    supervise: options.supervise ?? true,
    superviseIntervalSeconds: Number(process.env.PHASE0B_SUPERVISE_INTERVAL_SECONDS ?? '1'),
    monitorIntervalSeconds: Number(process.env.PHASE0B_MONITOR_INTERVAL_SECONDS ?? '1'),
    maintenanceIntervalSeconds: Number(process.env.PHASE0B_MAINTENANCE_INTERVAL_SECONDS ?? '1'),
    queueCacheIntervalSeconds: Number(process.env.PHASE0B_QUEUE_CACHE_INTERVAL_SECONDS ?? '1'),
  });
}
