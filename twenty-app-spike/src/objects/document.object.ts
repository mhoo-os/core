import {
  defineObject,
  FieldType,
  MetadataWritability,
} from 'twenty-sdk/define';

import {
  DOCUMENT_BYTE_LENGTH_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_CONTENT_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_CONTENT_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_LOGICAL_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_METADATA_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  DOCUMENT_PROVENANCE_HASH_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_RAW_ARTIFACT_HASH_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_RAW_ARTIFACT_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_REVISION_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_SOURCE_URI_FIELD_UNIVERSAL_IDENTIFIER,
  DOCUMENT_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineObject({
  universalIdentifier: DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'document',
  namePlural: 'documents',
  labelSingular: 'Document',
  labelPlural: 'Documents',
  description: 'Normalized document metadata and bounded searchable content.',
  icon: 'IconFileText',
  isSearchable: true,
  isUICreatable: false,
  isUIEditable: false,
  writability: MetadataWritability.APPLICATION,
  labelIdentifierFieldMetadataUniversalIdentifier:
    DOCUMENT_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: DOCUMENT_LOGICAL_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'logicalKey',
      label: 'Logical key',
    },
    {
      universalIdentifier: DOCUMENT_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'title',
      label: 'Title',
    },
    {
      universalIdentifier: DOCUMENT_CONTENT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'content',
      label: 'Content',
    },
    {
      universalIdentifier: DOCUMENT_SOURCE_URI_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'sourceUri',
      label: 'Source URI',
    },
    {
      universalIdentifier: DOCUMENT_REVISION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'revision',
      label: 'Revision',
    },
    {
      universalIdentifier: DOCUMENT_PROVENANCE_HASH_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'provenanceHash',
      label: 'Provenance hash',
    },
    {
      universalIdentifier: DOCUMENT_RAW_ARTIFACT_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'rawArtifactKey',
      label: 'Raw artifact key',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: DOCUMENT_RAW_ARTIFACT_HASH_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'rawArtifactHash',
      label: 'Raw artifact hash',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: DOCUMENT_CONTENT_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'contentType',
      label: 'Content type',
    },
    {
      universalIdentifier: DOCUMENT_BYTE_LENGTH_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'byteLength',
      label: 'Byte length',
    },
    {
      universalIdentifier: DOCUMENT_METADATA_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RAW_JSON,
      name: 'metadata',
      label: 'Metadata',
    },
  ],
});
