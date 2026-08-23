import {
  canonicalizeSections,
  approximateTokenCount,
  type KnowledgeChunk,
  type TransformConfiguration,
  type TransformInput,
  type TransformedSection,
  phase0cConfiguration,
} from './transform-contract';

type Heading = { level: number; title: string };

function sectionsFromMarkdown(content: string): TransformedSection[] {
  const sections: TransformedSection[] = [];
  const headingStack: Heading[] = [];
  let lines: string[] = [];
  let inFencedCode = false;

  const flush = () => {
    const text = lines.join('\n').trim();
    if (text) sections.push({ text, breadcrumb: headingStack.map((heading) => heading.title) });
    lines = [];
  };

  for (const line of content.replaceAll('\r\n', '\n').split('\n')) {
    if (/^\s*(```|~~~)/u.test(line)) inFencedCode = !inFencedCode;
    const heading = !inFencedCode ? /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line) : undefined;
    if (!heading) {
      lines.push(line);
      continue;
    }

    flush();
    const level = heading[1]?.length ?? 1;
    const title = heading[2]?.trim() ?? '';
    while (headingStack.at(-1)?.level && headingStack.at(-1)!.level >= level) headingStack.pop();
    headingStack.push({ level, title });
    // Retain the heading text in the body so it remains readable when displayed
    // without breadcrumb metadata.
    lines.push(title);
  }
  flush();
  return sections;
}

function splitLongSection(section: TransformedSection, configuration: TransformConfiguration): TransformedSection[] {
  if (approximateTokenCount(section.text) <= configuration.targetChunkTokens) return [section];

  const paragraphs = section.text.split(/\n\s*\n/u).map((value) => value.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (current.length > 0) chunks.push(current.join('\n\n'));
    current = [];
    currentTokens = 0;
  };

  for (const paragraph of paragraphs) {
    const paragraphTokens = approximateTokenCount(paragraph);
    if (paragraphTokens > configuration.targetChunkTokens) {
      flush();
      const words = paragraph.split(/\s+/u);
      for (let index = 0; index < words.length; index += configuration.targetChunkTokens) {
        chunks.push(words.slice(index, index + configuration.targetChunkTokens).join(' '));
      }
      continue;
    }
    if (currentTokens > 0 && currentTokens + paragraphTokens > configuration.targetChunkTokens) flush();
    current.push(paragraph);
    currentTokens += paragraphTokens;
  }
  flush();
  return chunks.map((text) => ({ text, breadcrumb: section.breadcrumb }));
}

/** Minimal comparison baseline: headings plus deterministic paragraph splitting. */
export function transformWithNativeBaseline(
  input: TransformInput,
  configuration: TransformConfiguration = phase0cConfiguration,
): KnowledgeChunk[] {
  return canonicalizeSections(
    input,
    sectionsFromMarkdown(input.content).flatMap((section) => splitLongSection(section, configuration)),
    configuration,
  );
}
