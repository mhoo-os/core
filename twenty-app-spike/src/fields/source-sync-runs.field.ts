import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  SOURCE_SYNC_RUNS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_SOURCE_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: SOURCE_SYNC_RUNS_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'syncRuns',
  label: 'Sync runs',
  relationTargetObjectMetadataUniversalIdentifier:
    SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    SYNC_RUN_SOURCE_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
