import { defineIndex } from 'twenty-sdk/define';

import {
  DOCUMENT_LOGICAL_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineIndex({
  universalIdentifier: 'd725770a-e94c-4b75-ac28-e15c6561b55c',
  objectUniversalIdentifier: DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '24d091d5-5613-401d-ac3a-a6b6eef0cb2f',
      fieldUniversalIdentifier: DOCUMENT_LOGICAL_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
