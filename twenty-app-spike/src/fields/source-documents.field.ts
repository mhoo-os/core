import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  DOCUMENT_SOURCE_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  SOURCE_DOCUMENTS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: SOURCE_DOCUMENTS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'documents',
  label: 'Documents',
  relationTargetObjectMetadataUniversalIdentifier:
    DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    DOCUMENT_SOURCE_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
