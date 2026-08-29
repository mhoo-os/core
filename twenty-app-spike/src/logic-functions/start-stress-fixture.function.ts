import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { enqueueJobs, kv } from 'twenty-sdk/logic-function';

import {
  INGEST_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  START_STRESS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { IngestionInvariantError } from 'src/domain/ingestion';
import { getSyntheticFailureMarkerKey } from 'src/domain/proof-keys';
import { RestCoreStore } from 'src/domain/rest-core-store';
import {
  buildStressPagePayload,
  buildStressSource,
  buildSyncRun,
  STRESS_FIXTURE_ID,
  STRESS_RECORD_COUNT,
  validateStressFixtureRequest,
} from 'src/domain/synthetic-fixture';

export const startStressFixtureHandler = async (
  payload: RoutePayload<unknown>,
  context: { workspaceId: string },
) => {
  validateStressFixtureRequest(payload.body);

  const store = new RestCoreStore();
  const source = buildStressSource();
  const proposedRun = buildSyncRun({
    fixtureId: STRESS_FIXTURE_ID,
    sourceId: source.id,
    expectedCount: STRESS_RECORD_COUNT,
    triggerKind: 'HTTP_BACKGROUND',
    startedAt: new Date().toISOString(),
  });

  await store.upsertKnowledgeSource(source);

  const existingRun = await store.getSyncRun(proposedRun.id);
  const run = existingRun ?? (await store.upsertSyncRun(proposedRun));

  if (
    run.sourceId !== source.id ||
    run.expectedCount !== STRESS_RECORD_COUNT ||
    run.runKey !== STRESS_FIXTURE_ID
  ) {
    throw new IngestionInvariantError(
      `Existing run ${run.id} conflicts with the bounded stress fixture`,
    );
  }

  if (run.status === 'COMPLETED') {
    return {
      outcome: 'already-completed',
      workspaceId: context.workspaceId,
      runId: run.id,
      cursor: run.cursor,
    };
  }

  if (run.status !== 'RUNNING') {
    throw new IngestionInvariantError(
      `Existing run ${run.id} cannot restart from ${run.status}`,
    );
  }

  if (existingRun === null) {
    await kv.delete(getSyntheticFailureMarkerKey(run.id)).catch(() => false);
  }

  await enqueueJobs({
    logicFunctionUniversalIdentifier:
      INGEST_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
    payloads: [buildStressPagePayload(run.cursor)],
    retryLimit: 3,
  });

  return {
    outcome: existingRun === null ? 'started' : 'resumed',
    workspaceId: context.workspaceId,
    runId: run.id,
    cursor: run.cursor,
    expectedCount: run.expectedCount,
  };
};

export default defineLogicFunction({
  universalIdentifier: START_STRESS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'start-stress-fixture',
  description:
    'Starts or resumes a fixed 1,000-record synthetic background ingestion.',
  timeoutSeconds: 60,
  handler: startStressFixtureHandler,
  httpRouteTriggerSettings: {
    path: '/start-stress-fixture',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
