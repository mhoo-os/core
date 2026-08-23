import { postgresAdapter } from '@payloadcms/db-postgres';
import { buildConfig } from 'payload';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for the Payload feasibility probe');

export default buildConfig({
  admin: { disable: true },
  collections: [],
  db: postgresAdapter({ pool: { connectionString: databaseUrl }, push: true }),
  graphQL: { disable: true },
  jobs: { autoRun: [] },
  secret: process.env.PAYLOAD_SECRET ?? 'phase0-feasibility-only',
});
