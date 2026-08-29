import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  SOURCE_SYNC_RUNS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_SOURCE_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: SYNC_RUN_SOURCE_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'source',
  label: 'Source',
  relationTargetObjectMetadataUniversalIdentifier:
    KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    SOURCE_SYNC_RUNS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.RESTRICT,
    joinColumnName: 'sourceId',
  },
});
