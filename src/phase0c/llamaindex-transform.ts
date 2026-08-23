import { Document, MarkdownNodeParser, MetadataMode, SentenceSplitter } from 'llamaindex';

import {
  canonicalizeSections,
  type KnowledgeChunk,
  type TransformConfiguration,
  type TransformInput,
  type TransformedSection,
  phase0cConfiguration,
} from './transform-contract';

function breadcrumbFromLlamaMetadata(metadata: Record<string, unknown>): string[] {
  return [1, 2, 3, 4, 5, 6]
    .map((level) => metadata[`Header_${level}`])
    .filter((heading): heading is string => typeof heading === 'string' && heading.length > 0);
}

/**
 * The sole LlamaIndex boundary. Llama nodes are used transiently and converted
 * immediately; their IDs, types, storage, indexes, and metadata conventions do
 * not escape this module.
 */
export function transformWithLlamaIndex(
  input: TransformInput,
  configuration: TransformConfiguration = phase0cConfiguration,
): KnowledgeChunk[] {
  const document = new Document({ text: input.content });
  const markdownParser = new MarkdownNodeParser();
  const sections = markdownParser.getNodesFromDocuments([document]);
  const splitter = new SentenceSplitter({
    chunkSize: configuration.targetChunkTokens,
    chunkOverlap: 0,
  });
  const nodes = splitter.getNodesFromDocuments(sections);
  const transformed: TransformedSection[] = nodes.map((node) => ({
    text: node.getContent(MetadataMode.NONE),
    breadcrumb: breadcrumbFromLlamaMetadata(node.metadata),
  }));

  return canonicalizeSections(input, transformed, configuration);
}
