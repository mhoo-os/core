import { defineLogicFunction } from 'twenty-sdk/define';
import {
  enqueueJobs,
  kv,
  RetryableLogicFunctionError,
  type LogicFunctionExecutionContext,
} from 'twenty-sdk/logic-function';

import { INGEST_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  IngestionInvariantError,
  processStressPage,
} from 'src/domain/ingestion';
import { getSyntheticFailureMarkerKey } from 'src/domain/proof-keys';
import { RestCoreStore } from 'src/domain/rest-core-store';
import {
  buildStressPagePayload,
  STRESS_FAILURE_CURSOR,
  validatePageJobPayload,
} from 'src/domain/synthetic-fixture';

export const ingestPageHandler = async (
  rawPayload: unknown,
  context: LogicFunctionExecutionContext,
) => {
  const payload = validatePageJobPayload(rawPayload);
  const store = new RestCoreStore();

  try {
    const result = await processStressPage({
      store,
      payload,
      now: new Date().toISOString(),
      afterDocumentsPersisted: async () => {
        if (payload.cursor !== STRESS_FAILURE_CURSOR) {
          return;
        }

        const markerKey = getSyntheticFailureMarkerKey(payload.runId);
        const failureAlreadyInjected = await kv.get<boolean>(markerKey);

        if (failureAlreadyInjected !== true) {
          await kv.set(markerKey, true);
          throw new RetryableLogicFunctionError(
            `Synthetic retry proof after page ${payload.cursor} persisted but before checkpoint`,
          );
        }
      },
    });

    if (!result.completed) {
      await enqueueJobs({
        logicFunctionUniversalIdentifier:
          INGEST_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
        payloads: [buildStressPagePayload(result.run.cursor)],
        retryLimit: 3,
      });
    }

    console.log('[mhoo-core-spike] page processed', {
      workspaceId: context.workspaceId,
      retryCount: context.retryCount,
      pageStart: result.pageStart,
      pageEnd: result.pageEnd,
      replayed: result.replayed,
      completed: result.completed,
    });

    return result;
  } catch (error) {
    if (
      error instanceof RetryableLogicFunctionError ||
      error instanceof IngestionInvariantError
    ) {
      throw error;
    }

    throw new RetryableLogicFunctionError(
      `Synthetic page ${payload.cursor} failed transiently: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: INGEST_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'ingest-page',
  description:
    'Upserts one deterministic page, then checkpoints and enqueues continuation.',
  timeoutSeconds: 300,
  handler: ingestPageHandler,
});
