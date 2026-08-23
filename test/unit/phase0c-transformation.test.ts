import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { transformWithLlamaIndex } from '../../src/phase0c/llamaindex-transform';
import { transformWithNativeBaseline } from '../../src/phase0c/native-transform';
import {
  approximateTokenCount,
  breadcrumbTokenLimit,
  phase0cConfiguration,
  serializeCanonicalChunks,
  type TransformInput,
} from '../../src/phase0c/transform-contract';

const fixtureDirectory = path.join(process.cwd(), 'test/fixtures/phase0c');
const fixtureNames = ['simple-prose.md', 'deep-headings.md', 'long-section.md', 'code-heavy.md', 'mixed-markdown.md'];
const transformers = [
  ['native', transformWithNativeBaseline],
  ['llamaindex', transformWithLlamaIndex],
] as const;

async function inputFor(name: string): Promise<TransformInput> {
  return {
    tenantId: '11111111-1111-4111-8111-111111111111',
    documentId: `fixture:${name}`,
    revision: 'phase0c-fixture-revision',
    content: await readFile(path.join(fixtureDirectory, name), 'utf8'),
    source: { kind: 'fixture', locator: `test/fixtures/phase0c/${name}` },
  };
}

for (const [name, transform] of transformers) {
  test(`${name}: output is deterministic, ordered, and Mhoo-owned`, async () => {
    for (const fixture of fixtureNames) {
      const input = await inputFor(fixture);
      const first = transform(input);
      const second = transform(input);
      assert.equal(serializeCanonicalChunks(first), serializeCanonicalChunks(second));
      assert.ok(first.length > 0, `${fixture} returned no chunks`);
      assert.deepEqual(first.map((chunk) => chunk.ordinal), first.map((_, index) => index + 1));
      assert.equal(new Set(first.map((chunk) => chunk.id)).size, first.length);
      assert.deepEqual(first.map((chunk) => chunk.source), Array.from({ length: first.length }, () => input.source));
      for (const chunk of first) {
        assert.equal(chunk.tenantId, input.tenantId);
        assert.equal(chunk.documentId, input.documentId);
        assert.equal(chunk.revision, input.revision);
        assert.match(chunk.id, /^[a-f0-9]{64}$/u);
        assert.match(chunk.contentHash, /^[a-f0-9]{64}$/u);
        assert.ok(approximateTokenCount(chunk.breadcrumb.join(' ')) <= breadcrumbTokenLimit());
      }
    }
  });
}

test('both transforms retain Markdown-specific structure through difficult boundaries', async () => {
  const deep = await inputFor('deep-headings.md');
  const long = await inputFor('long-section.md');
  const code = await inputFor('code-heavy.md');
  const mixed = await inputFor('mixed-markdown.md');

  for (const [, transform] of transformers) {
    assert.ok(transform(deep).some((chunk) => chunk.breadcrumb.includes('Daily Handoff')));
    assert.ok(transform(long).length > 1, 'long section must split');
    assert.ok(transform(code).some((chunk) => chunk.text.includes('shell comment, not a document heading')));
    assert.ok(transform(mixed).some((chunk) => chunk.text.includes('| Gate | Expected |')));
  }
});

test('LlamaIndex is isolated to its removable adapter and transforms are offline/persistence-free', async () => {
  const sourceDirectory = path.join(process.cwd(), 'src/phase0c');
  const sourceFiles = await readdir(sourceDirectory);
  const imports = await Promise.all(sourceFiles.map(async (file) => [file, await readFile(path.join(sourceDirectory, file), 'utf8')] as const));
  const llamaImports = imports.filter(([, content]) => /from 'llamaindex'/u.test(content));
  assert.deepEqual(llamaImports.map(([file]) => file), ['llamaindex-transform.ts']);
  assert.ok(imports.every(([, content]) => !/storageContext|VectorStore|VectorStoreIndex|pg-boss|from ['"]\.\.\/db/u.test(content)));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error('network access is forbidden in Phase 0C'); }) as typeof fetch;
  try {
    for (const fixture of fixtureNames) {
      const input = await inputFor(fixture);
      assert.doesNotThrow(() => transformWithNativeBaseline(input));
      assert.doesNotThrow(() => transformWithLlamaIndex(input));
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
