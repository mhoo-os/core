import { defineIndex } from 'twenty-sdk/define';

import {
  KNOWLEDGE_SOURCE_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineIndex({
  universalIdentifier: '28c91a8e-16f2-4002-8cf4-29f6ee681c6f',
  objectUniversalIdentifier: KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: 'a4a74451-63f3-4267-a26f-d573da86a395',
      fieldUniversalIdentifier: KNOWLEDGE_SOURCE_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
