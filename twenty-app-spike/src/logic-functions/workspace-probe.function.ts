import { defineLogicFunction } from 'twenty-sdk/define';
import {
  type LogicFunctionExecutionContext,
} from 'twenty-sdk/logic-function';
import {
  RestApiClient,
  RestApiClientError,
} from 'twenty-client-sdk/rest';

import { WORKSPACE_PROBE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { deterministicUuid } from 'src/domain/deterministic-id';

const BOUNDED_DOCUMENT_ID = deterministicUuid(
  'document',
  'synthetic/local/bounded/item/0000',
);

export const workspaceProbeHandler = async (
  _payload: unknown,
  context: LogicFunctionExecutionContext,
) => {
  const client = new RestApiClient({ runAs: 'application' });
  let boundedDocumentPresent = false;

  try {
    await client.get(`/rest/documents/${BOUNDED_DOCUMENT_ID}`);
    boundedDocumentPresent = true;
  } catch (error) {
    if (!(error instanceof RestApiClientError) || error.status !== 404) {
      throw error;
    }
  }

  return {
    workspaceId: context.workspaceId,
    boundedDocumentPresent,
  };
};

export default defineLogicFunction({
  universalIdentifier: WORKSPACE_PROBE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'workspace-probe',
  description:
    'Returns only whether the bounded synthetic document exists in the token-selected Workspace.',
  timeoutSeconds: 15,
  handler: workspaceProbeHandler,
  httpRouteTriggerSettings: {
    path: '/workspace-probe',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
