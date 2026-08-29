import { defineIndex } from 'twenty-sdk/define';

import {
  SYNC_RUN_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineIndex({
  universalIdentifier: '53662695-28f7-442f-b482-ab3721f9e42b',
  objectUniversalIdentifier: SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '4512f2da-f271-4a48-b987-499051cb8ef9',
      fieldUniversalIdentifier: SYNC_RUN_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
