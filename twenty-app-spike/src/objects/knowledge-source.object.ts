import {
  defineObject,
  FieldType,
  MetadataWritability,
} from 'twenty-sdk/define';

import {
  KNOWLEDGE_SOURCE_DISPLAY_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  KNOWLEDGE_SOURCE_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  KNOWLEDGE_SOURCE_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
  KNOWLEDGE_SOURCE_PROVENANCE_HASH_FIELD_UNIVERSAL_IDENTIFIER,
  KNOWLEDGE_SOURCE_REVISION_FIELD_UNIVERSAL_IDENTIFIER,
  KNOWLEDGE_SOURCE_URI_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineObject({
  universalIdentifier: KNOWLEDGE_SOURCE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'knowledgeSource',
  namePlural: 'knowledgeSources',
  labelSingular: 'Knowledge source',
  labelPlural: 'Knowledge sources',
  description: 'A deterministic synthetic knowledge-source identity.',
  icon: 'IconDatabase',
  isSearchable: true,
  isUICreatable: false,
  isUIEditable: false,
  writability: MetadataWritability.APPLICATION,
  labelIdentifierFieldMetadataUniversalIdentifier:
    KNOWLEDGE_SOURCE_DISPLAY_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: KNOWLEDGE_SOURCE_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'sourceKey',
      label: 'Source key',
      description: 'Stable logical source identity.',
    },
    {
      universalIdentifier:
        KNOWLEDGE_SOURCE_DISPLAY_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'displayName',
      label: 'Display name',
    },
    {
      universalIdentifier: KNOWLEDGE_SOURCE_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'provider',
      label: 'Provider',
    },
    {
      universalIdentifier: KNOWLEDGE_SOURCE_URI_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'sourceUri',
      label: 'Source URI',
    },
    {
      universalIdentifier: KNOWLEDGE_SOURCE_REVISION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'revision',
      label: 'Revision',
    },
    {
      universalIdentifier:
        KNOWLEDGE_SOURCE_PROVENANCE_HASH_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'provenanceHash',
      label: 'Provenance hash',
    },
  ],
});
