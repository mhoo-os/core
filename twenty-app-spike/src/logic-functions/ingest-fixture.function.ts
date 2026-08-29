import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { INGEST_FIXTURE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ingestSingleFixture } from 'src/domain/ingestion';
import { RestCoreStore } from 'src/domain/rest-core-store';
import { validateSingleFixtureRequest } from 'src/domain/synthetic-fixture';

export const ingestFixtureHandler = async (
  payload: RoutePayload<unknown>,
  context: { workspaceId: string },
) => {
  validateSingleFixtureRequest(payload.body);

  const result = await ingestSingleFixture({
    store: new RestCoreStore(),
    now: new Date().toISOString(),
  });

  return {
    outcome: 'completed',
    workspaceId: context.workspaceId,
    ...result,
  };
};

export default defineLogicFunction({
  universalIdentifier: INGEST_FIXTURE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'ingest-fixture',
  description:
    'Validates and ingests one fixed local synthetic source, run, and document.',
  timeoutSeconds: 60,
  handler: ingestFixtureHandler,
  httpRouteTriggerSettings: {
    path: '/ingest-fixture',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
