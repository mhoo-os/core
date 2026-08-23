import { createHash } from 'node:crypto';

export type SourceLocator = {
  kind: 'fixture';
  locator: string;
};

export type TransformInput = {
  tenantId: string;
  documentId: string;
  revision: string;
  content: string;
  source: SourceLocator;
};

export type TransformConfiguration = {
  targetChunkTokens: number;
};

export type KnowledgeChunk = {
  id: string;
  tenantId: string;
  documentId: string;
  revision: string;
  ordinal: number;
  text: string;
  breadcrumb: string[];
  source: SourceLocator;
  contentHash: string;
};

export const phase0cConfiguration: TransformConfiguration = {
  targetChunkTokens: 160,
};

export function normalizeContent(value: string): string {
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim();
}

export function approximateTokenCount(value: string): number {
  const normalized = normalizeContent(value);
  return normalized ? normalized.split(/\s+/u).length : 0;
}

export function breadcrumbTokenLimit(configuration: TransformConfiguration = phase0cConfiguration): number {
  return Math.min(64, Math.floor(configuration.targetChunkTokens * 0.15));
}

export function capBreadcrumb(
  breadcrumb: readonly string[],
  configuration: TransformConfiguration = phase0cConfiguration,
): string[] {
  const limit = breadcrumbTokenLimit(configuration);
  const capped: string[] = [];
  let used = 0;

  // Keep the closest structural context first. It is more useful at a chunk
  // boundary than an outer title, and is deterministic when the cap is tight.
  for (const heading of [...breadcrumb].reverse()) {
    const words = normalizeContent(heading).split(/\s+/u).filter(Boolean);
    const remaining = limit - used;
    if (remaining <= 0) break;
    if (words.length <= remaining) {
      capped.unshift(words.join(' '));
      used += words.length;
    } else if (capped.length === 0) {
      capped.unshift(words.slice(0, remaining).join(' '));
      used = limit;
    }
  }

  return capped;
}

export function contentHash(text: string): string {
  return createHash('sha256').update(normalizeContent(text)).digest('hex');
}

export function knowledgeChunkId(input: Omit<KnowledgeChunk, 'id'>): string {
  return createHash('sha256').update(JSON.stringify({
    tenantId: input.tenantId,
    documentId: input.documentId,
    revision: input.revision,
    ordinal: input.ordinal,
    source: input.source,
    contentHash: input.contentHash,
  })).digest('hex');
}

export type TransformedSection = {
  text: string;
  breadcrumb: string[];
};

/** Converts any parser result immediately to Mhoo's canonical chunk contract. */
export function canonicalizeSections(
  input: TransformInput,
  sections: readonly TransformedSection[],
  configuration: TransformConfiguration = phase0cConfiguration,
): KnowledgeChunk[] {
  return sections
    .map((section) => ({
      text: normalizeContent(section.text),
      breadcrumb: capBreadcrumb(section.breadcrumb, configuration),
    }))
    .filter((section) => section.text.length > 0)
    .map((section, index) => {
      const chunk = {
        tenantId: input.tenantId,
        documentId: input.documentId,
        revision: input.revision,
        ordinal: index + 1,
        text: section.text,
        breadcrumb: section.breadcrumb,
        source: { ...input.source },
        contentHash: contentHash(section.text),
      } satisfies Omit<KnowledgeChunk, 'id'>;

      return { id: knowledgeChunkId(chunk), ...chunk };
    });
}

export function serializeCanonicalChunks(chunks: readonly KnowledgeChunk[]): string {
  return JSON.stringify(chunks);
}
