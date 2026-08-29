import {
  defineObject,
  FieldType,
  MetadataWritability,
} from 'twenty-sdk/define';

import {
  SYNC_RUN_COMPLETED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_CURSOR_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_EXPECTED_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_FAILURE_REASON_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_FIXTURE_REVISION_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_PROCESSED_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_STARTED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  SYNC_RUN_TRIGGER_KIND_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineObject({
  universalIdentifier: SYNC_RUN_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'syncRun',
  namePlural: 'syncRuns',
  labelSingular: 'Sync run',
  labelPlural: 'Sync runs',
  description: 'A bounded ingestion run and its durable checkpoint.',
  icon: 'IconRefresh',
  isSearchable: true,
  isUICreatable: false,
  isUIEditable: false,
  writability: MetadataWritability.APPLICATION,
  labelIdentifierFieldMetadataUniversalIdentifier:
    SYNC_RUN_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: SYNC_RUN_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'runKey',
      label: 'Run key',
    },
    {
      universalIdentifier: SYNC_RUN_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'status',
      label: 'Status',
    },
    {
      universalIdentifier: SYNC_RUN_CURSOR_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'cursor',
      label: 'Cursor',
    },
    {
      universalIdentifier: SYNC_RUN_EXPECTED_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'expectedCount',
      label: 'Expected count',
    },
    {
      universalIdentifier: SYNC_RUN_PROCESSED_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'processedCount',
      label: 'Processed count',
    },
    {
      universalIdentifier: SYNC_RUN_FIXTURE_REVISION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'fixtureRevision',
      label: 'Fixture revision',
    },
    {
      universalIdentifier: SYNC_RUN_TRIGGER_KIND_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'triggerKind',
      label: 'Trigger kind',
    },
    {
      universalIdentifier: SYNC_RUN_STARTED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'startedAt',
      label: 'Started at',
    },
    {
      universalIdentifier: SYNC_RUN_COMPLETED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'completedAt',
      label: 'Completed at',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: SYNC_RUN_FAILURE_REASON_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'failureReason',
      label: 'Failure reason',
      isNullable: true,
      defaultValue: null,
    },
  ],
});
