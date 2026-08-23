import type { Db } from 'pg-boss';
import type { Pool, PoolClient, QueryResultRow } from 'pg';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

/** Adapts an explicitly chosen pg pool/client to pg-boss. */
export function pgBossDatabase(connection: Queryable): Db {
  return {
    async executeSql(text: string, values?: unknown[]) {
      return connection.query<QueryResultRow>(text, values);
    },
  };
}
