import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  DOCUMENT_SYNC_RUN_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_DOCUMENTS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: SYNC_RUN_DOCUMENTS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'documents',
  label: 'Documents',
  relationTargetObjectMetadataUniversalIdentifier:
    DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    DOCUMENT_SYNC_RUN_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
