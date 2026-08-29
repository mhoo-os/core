import { defineLogicFunction, type CronPayload } from 'twenty-sdk/define';
import { enqueueJobs, kv } from 'twenty-sdk/logic-function';

import {
  INGEST_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  RECOVER_SYNC_RUNS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { RestCoreStore } from 'src/domain/rest-core-store';
import { RECOVERY_SWEEP_MARKER_KEY } from 'src/domain/proof-keys';
import {
  buildStressPagePayload,
  STRESS_FIXTURE_ID,
} from 'src/domain/synthetic-fixture';

export const recoverSyncRunsHandler = async (_payload: CronPayload) => {
  const runs = await new RestCoreStore().listSyncRuns();
  const resumableRuns = runs.filter(
    (run) =>
      run.runKey === STRESS_FIXTURE_ID &&
      run.status === 'RUNNING' &&
      run.cursor < run.expectedCount,
  );

  if (resumableRuns.length > 0) {
    await enqueueJobs({
      logicFunctionUniversalIdentifier:
        INGEST_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
      payloads: resumableRuns.map((run) =>
        buildStressPagePayload(run.cursor),
      ),
      retryLimit: 3,
    });
  }

  await kv.set(RECOVERY_SWEEP_MARKER_KEY, true);

  console.log('[mhoo-core-spike] recovery sweep', {
    resumableCount: resumableRuns.length,
  });

  return { resumableCount: resumableRuns.length };
};

export default defineLogicFunction({
  universalIdentifier: RECOVER_SYNC_RUNS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'recover-sync-runs',
  description:
    'Repairs the checkpoint-to-enqueue liveness gap for the bounded stress run.',
  timeoutSeconds: 60,
  handler: recoverSyncRunsHandler,
  cronTriggerSettings: { pattern: '* * * * *' },
});
