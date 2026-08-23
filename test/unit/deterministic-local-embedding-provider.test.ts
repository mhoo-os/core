import assert from 'node:assert/strict';
import test from 'node:test';

import { DeterministicLocalEmbeddingProvider } from '../../src/embedding/deterministic-local-embedding-provider';

test('produces a stable, fixed-size local vector', async () => {
  const provider = new DeterministicLocalEmbeddingProvider(8);

  assert.deepEqual(await provider.embed('Mhoo Core'), await provider.embed('Mhoo Core'));
  assert.equal((await provider.embed('Mhoo Core')).length, 8);
});
