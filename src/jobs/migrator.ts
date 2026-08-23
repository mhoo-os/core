import { PgBoss } from 'pg-boss';
import type { Pool } from 'pg';

import { PHASE0B_DEAD_LETTER_QUEUE, PHASE0B_MOCK_INGESTION_QUEUE } from './boss';
import { pgBossDatabase } from './pg-boss-db';

/**
 * Runs only with core_migrator credentials. Runtime processes set migrate:false
 * and merely verify this installed version at startup.
 */
export async function installOrUpgradePgBoss(migratorPool: Pool): Promise<void> {
  const boss = new PgBoss({
    db: pgBossDatabase(migratorPool),
    schema: 'pgboss',
    migrate: true,
    createSchema: true,
    supervise: false,
    schedule: false,
  });

  await boss.start();
  try {
    await boss.createQueue(PHASE0B_DEAD_LETTER_QUEUE, {
      retryLimit: 0,
      retentionSeconds: 86_400,
    });
    await boss.createQueue(PHASE0B_MOCK_INGESTION_QUEUE, {
      deadLetter: PHASE0B_DEAD_LETTER_QUEUE,
      expireInSeconds: 2,
      retryLimit: 2,
      retryDelay: 0,
      retentionSeconds: 86_400,
    });
  } finally {
    await boss.stop({ graceful: false, close: false });
  }
}
