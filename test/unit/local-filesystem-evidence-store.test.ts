import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { LocalFilesystemEvidenceStore } from '../../src/storage/local-filesystem-evidence-store';

test('stores one immutable local evidence object per key', async () => {
  const body = new TextEncoder().encode('evidence');
  const store = new LocalFilesystemEvidenceStore(await mkdtemp(path.join(tmpdir(), 'mhoo-core-store-')));
  const sha256 = createHash('sha256').update(body).digest('hex');

  assert.deepEqual(await store.put('evidence/a', { body, contentType: 'text/plain', sha256 }), { created: true });
  assert.deepEqual(await store.put('evidence/a', { body, contentType: 'text/plain', sha256 }), { created: false });
  assert.equal((await store.get('evidence/a'))?.sha256, sha256);
});
