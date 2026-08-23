import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';

import { installOrUpgradePgBoss } from '../src/jobs/migrator';

const migratorUrl = process.env.CORE_MIGRATOR_DATABASE_URL;

if (!migratorUrl) throw new Error('CORE_MIGRATOR_DATABASE_URL is required');

const pool = new Pool({ connectionString: migratorUrl, application_name: 'mhoo-core-migrator' });

try {
  for (const migration of [
    '0001_phase0_core.sql',
    '0002_phase0_runtime_role.sql',
    '0003_phase0b_runtime_roles.sql',
    '0004_phase0b_mock_ingestion.sql',
  ]) {
    await pool.query(await readFile(path.join(process.cwd(), 'db/migrations', migration), 'utf8'));
  }
  await installOrUpgradePgBoss(pool);
  await pool.query(await readFile(path.join(process.cwd(), 'db/migrations/0005_phase0b_pgboss_runtime_grants.sql'), 'utf8'));
  console.log('Core migrations and pg-boss install/upgrade completed with migrator credentials.');
} finally {
  await pool.end();
}
