import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  DOCUMENT_SOURCE_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  SOURCE_DOCUMENTS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: DOCUMENT_SOURCE_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'source',
  label: 'Source',
  relationTargetObjectMetadataUniversalIdentifier:
    KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    SOURCE_DOCUMENTS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.RESTRICT,
    joinColumnName: 'sourceId',
  },
});
