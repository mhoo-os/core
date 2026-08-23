import { tenantId, type TenantId } from '../db/tenant-context';

declare const mhooJobContextBrand: unique symbol;

export type MhooJobActor = Readonly<{
  type: 'user' | 'system' | 'service';
  id: string;
}>;

/**
 * Metadata resolved by Core's trusted server-side authorization boundary.
 * The private brand means callers cannot create a trusted context with an
 * object literal; all construction goes through createMhooJobContext.
 */
export type MhooJobContext = Readonly<{
  version: 1;
  tenantId: TenantId;
  operationId?: string;
  actor: MhooJobActor;
  requestId?: string;
  traceId?: string;
}> & { readonly [mhooJobContextBrand]: true };

export type MhooJobContextInput = Readonly<{
  tenantId: TenantId;
  operationId?: string;
  actor: MhooJobActor;
  requestId?: string;
  traceId?: string;
}>;

export type TenantFreePayload = Readonly<{ tenantId?: never }>;

export type MhooJobEnvelope<TPayload extends TenantFreePayload> = Readonly<{
  context: MhooJobContext;
  payload: Readonly<TPayload>;
}>;

export type TenantJobHandler<TPayload extends TenantFreePayload, TResult> = (
  context: MhooJobContext,
  payload: Readonly<TPayload>,
) => Promise<TResult>;

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Mhoo job context ${field} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return nonEmptyString(value, field);
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Mhoo job ${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function createMhooJobContext(input: MhooJobContextInput): MhooJobContext {
  const actorType = input.actor.type;
  if (actorType !== 'user' && actorType !== 'system' && actorType !== 'service') {
    throw new Error('Mhoo job context actor.type is invalid');
  }
  const context = {
    version: 1 as const,
    tenantId: tenantId(nonEmptyString(input.tenantId, 'tenantId')),
    operationId: optionalString(input.operationId, 'operationId'),
    actor: Object.freeze({ type: actorType, id: nonEmptyString(input.actor.id, 'actor.id') }),
    requestId: optionalString(input.requestId, 'requestId'),
    traceId: optionalString(input.traceId, 'traceId'),
  };
  return Object.freeze(context) as MhooJobContext;
}

export function createMhooJobEnvelope<TPayload extends TenantFreePayload>(
  context: MhooJobContext,
  payload: TPayload,
): MhooJobEnvelope<TPayload> {
  return Object.freeze({ context, payload: Object.freeze({ ...payload }) });
}

/** Re-validates persisted JSON before a worker treats it as trusted context. */
export function parseMhooJobContext(value: unknown): MhooJobContext {
  const raw = asRecord(value, 'context');
  if (raw.version !== 1) throw new Error('Mhoo job context version must be 1');
  const actor = asRecord(raw.actor, 'context.actor');
  const actorType = actor.type;
  if (actorType !== 'user' && actorType !== 'system' && actorType !== 'service') {
    throw new Error('Mhoo job context actor.type is invalid');
  }
  return createMhooJobContext({
    tenantId: tenantId(nonEmptyString(raw.tenantId, 'tenantId')),
    operationId: optionalString(raw.operationId, 'operationId'),
    actor: { type: actorType, id: nonEmptyString(actor.id, 'actor.id') },
    requestId: optionalString(raw.requestId, 'requestId'),
    traceId: optionalString(raw.traceId, 'traceId'),
  });
}

export function parseMhooJobEnvelope<TPayload extends TenantFreePayload>(
  value: unknown,
  parsePayload: (value: unknown) => TPayload,
): MhooJobEnvelope<TPayload> {
  const raw = asRecord(value, 'envelope');
  return createMhooJobEnvelope(parseMhooJobContext(raw.context), parsePayload(raw.payload));
}
