import { defineLogicFunction } from 'twenty-sdk/define';
import { kv, type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { PROOF_STATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  getSyntheticFailureMarkerKey,
  RECOVERY_SWEEP_MARKER_KEY,
  sourceCreatedReceiptKey,
} from 'src/domain/proof-keys';
import {
  buildStressPagePayload,
  buildStressSource,
} from 'src/domain/synthetic-fixture';

export const proofStateHandler = async (
  _payload: unknown,
  context: LogicFunctionExecutionContext,
) => {
  const stressRunId = buildStressPagePayload(0).runId;
  const stressSourceId = buildStressSource().id;

  const [failureMarker, sourceEventReceipt, recoverySweepMarker] =
    await Promise.all([
      kv.get<boolean>(getSyntheticFailureMarkerKey(stressRunId)),
      kv.get<{ observed?: boolean }>(sourceCreatedReceiptKey(stressSourceId)),
      kv.get<boolean>(RECOVERY_SWEEP_MARKER_KEY),
    ]);

  return {
    workspaceId: context.workspaceId,
    syntheticFailureInjected: failureMarker === true,
    sourceCreatedEventObserved: sourceEventReceipt?.observed === true,
    recoveryCronObserved: recoverySweepMarker === true,
  };
};

export default defineLogicFunction({
  universalIdentifier: PROOF_STATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'proof-state',
  description: 'Returns only boolean receipts for bounded synthetic proofs.',
  timeoutSeconds: 15,
  handler: proofStateHandler,
  httpRouteTriggerSettings: {
    path: '/proof-state',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
