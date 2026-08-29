import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  DOCUMENT_SYNC_RUN_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_DOCUMENTS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: DOCUMENT_SYNC_RUN_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'syncRun',
  label: 'Sync run',
  relationTargetObjectMetadataUniversalIdentifier:
    SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    SYNC_RUN_DOCUMENTS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.RESTRICT,
    joinColumnName: 'syncRunId',
  },
});
