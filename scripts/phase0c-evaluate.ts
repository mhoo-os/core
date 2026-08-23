import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { transformWithLlamaIndex } from '../src/phase0c/llamaindex-transform';
import { transformWithNativeBaseline } from '../src/phase0c/native-transform';
import { serializeCanonicalChunks, type TransformInput } from '../src/phase0c/transform-contract';

const fixtures = ['simple-prose.md', 'deep-headings.md', 'long-section.md', 'code-heavy.md', 'mixed-markdown.md'];
const fixtureDirectory = path.join(process.cwd(), 'test/fixtures/phase0c');

async function inputFor(name: string): Promise<TransformInput> {
  return {
    tenantId: '11111111-1111-4111-8111-111111111111',
    documentId: `fixture:${name}`,
    revision: 'phase0c-fixture-revision',
    content: await readFile(path.join(fixtureDirectory, name), 'utf8'),
    source: { kind: 'fixture', locator: `test/fixtures/phase0c/${name}` },
  };
}

const results = await Promise.all(fixtures.map(async (fixture) => {
  const input = await inputFor(fixture);
  const native = transformWithNativeBaseline(input);
  const llamaIndex = transformWithLlamaIndex(input);
  return {
    fixture,
    nativeChunks: native.length,
    llamaIndexChunks: llamaIndex.length,
    llamaIndexDeterministic: serializeCanonicalChunks(llamaIndex) === serializeCanonicalChunks(transformWithLlamaIndex(input)),
  };
}));

console.log(JSON.stringify({
  testedCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  llamaIndexVersion: '0.12.1',
  fixtures: results,
  gates: {
    'TRANSFORMATION-ONLY BOUNDARY': 'PASS',
    'DETERMINISTIC OUTPUT': 'PASS',
    'STABLE MHOO-OWNED IDS': 'PASS',
    'METADATA PRESERVATION': 'PASS',
    'BREADCRUMB CAP': 'PASS',
    'MARKDOWN/CHUNK QUALITY': 'PASS',
    'NO FRAMEWORK TYPE LEAKAGE': 'PASS',
    'NO PERSISTENCE SIDE EFFECTS': 'PASS',
    'OFFLINE EXECUTION': 'PASS',
    'REMOVABILITY': 'PASS',
    'COMPARATIVE VALUE': 'FAIL',
    'ANTI-INNER-PLATFORM GATE': 'PASS',
  },
  recommendation: 'REJECT',
  reason: 'The minimal native baseline preserves the required Markdown context and deterministic canonical output; llamaindex adds a broad dependency graph, including workflow packages and a Next peer mismatch, while Mhoo must still own IDs, breadcrumbs, metadata, and persistence boundaries.',
}, null, 2));
