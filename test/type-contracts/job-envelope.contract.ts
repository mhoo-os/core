import { tenantId } from '../../src/db/tenant-context';
import type { MhooJobContext } from '../../src/jobs/context';
import type { MockIngestionPayload } from '../../src/jobs/enqueue';

// These compile-time assertions protect the handler contract: only the context
// factory can create trusted tenant metadata, and payloads cannot carry it.

// @ts-expect-error MhooJobContext is branded and cannot be made from JSON/object literals.
const forgedContext: MhooJobContext = {
  version: 1,
  tenantId: tenantId('11111111-1111-4111-8111-111111111111'),
  actor: { type: 'system', id: 'forged' },
};

const payloadWithoutTenant: MockIngestionPayload = {
  ingestionId: '11111111-1111-4111-8111-111111111111',
  documentId: 'document',
  sourceRevision: 'revision',
  transformVersion: 'transform',
};

const payloadWithForbiddenTenant: MockIngestionPayload = {
  ...payloadWithoutTenant,
  // @ts-expect-error Tenant context belongs in MhooJobEnvelope.context, never the payload.
  tenantId: tenantId('22222222-2222-4222-8222-222222222222'),
};

void forgedContext;
void payloadWithForbiddenTenant;
