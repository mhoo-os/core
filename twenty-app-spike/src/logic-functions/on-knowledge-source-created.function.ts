import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordCreateEvent,
} from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';

import { SOURCE_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { sourceCreatedReceiptKey } from 'src/domain/proof-keys';

export const onKnowledgeSourceCreatedHandler = async (
  payload: DatabaseEventPayload<ObjectRecordCreateEvent<{ id: string }>>,
) => {
  const sourceId = payload.properties.after.id;

  await kv.set(sourceCreatedReceiptKey(sourceId), {
    observed: true,
    sourceId,
  });

  console.log('[mhoo-core-spike] source-created event', { sourceId });

  return { observed: true, sourceId };
};

export default defineLogicFunction({
  universalIdentifier: SOURCE_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'on-knowledge-source-created',
  description: 'Records a synthetic receipt for one database event.',
  timeoutSeconds: 30,
  handler: onKnowledgeSourceCreatedHandler,
  databaseEventTriggerSettings: {
    eventName: 'knowledgeSource.created',
  },
});
