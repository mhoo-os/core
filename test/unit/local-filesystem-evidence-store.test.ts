import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  contentAddressedEvidenceKey,
  putContentAddressedEvidence,
} from '../../src/storage/evidence-store';
import { LocalFilesystemEvidenceStore } from '../../src/storage/local-filesystem-evidence-store';

function evidence(body: Uint8Array, contentType = 'text/plain') {
  return { body, contentType, sha256: createHash('sha256').update(body).digest('hex') };
}

async function createStore(): Promise<{ root: string; store: LocalFilesystemEvidenceStore }> {
  const root = await mkdtemp(path.join(tmpdir(), 'mhoo-core-store-'));
  return { root, store: new LocalFilesystemEvidenceStore(root) };
}

function assertEvidenceEqual(actual: Awaited<ReturnType<LocalFilesystemEvidenceStore['get']>>, expected: ReturnType<typeof evidence>): void {
  assert.ok(actual);
  assert.deepEqual(new Uint8Array(actual.body), expected.body);
  assert.equal(actual.contentType, expected.contentType);
  assert.equal(actual.sha256, expected.sha256);
}

test('stores byte-exact immutable evidence under a deterministic content address', async () => {
  const { store } = await createStore();
  const object = evidence(new Uint8Array([0, 1, 2, 255, 10]), 'application/octet-stream');
  const key = contentAddressedEvidenceKey(object.sha256);

  assert.deepEqual(await putContentAddressedEvidence(store, object), {
    key,
    sha256: object.sha256,
    byteSize: object.body.byteLength,
    created: true,
  });
  assert.deepEqual(await putContentAddressedEvidence(store, object), {
    key,
    sha256: object.sha256,
    byteSize: object.body.byteLength,
    created: false,
  });
  assertEvidenceEqual(await store.get(key), object);
  assert.equal(await store.exists(key), true);
  assert.equal(await store.get(contentAddressedEvidenceKey('0'.repeat(64))), undefined);
  assert.equal(await store.exists(contentAddressedEvidenceKey('0'.repeat(64))), false);
});

test('rejects invalid evidence before publishing it', async () => {
  const { store } = await createStore();
  const key = contentAddressedEvidenceKey('0'.repeat(64));
  await assert.rejects(
    () => store.put(key, { body: new TextEncoder().encode('evidence'), contentType: 'text/plain', sha256: '0'.repeat(64) }),
    /does not match supplied SHA-256/u,
  );
  await assert.rejects(
    () => store.put('../escape', evidence(new TextEncoder().encode('evidence'))),
    /canonical sha256 content address/u,
  );
  await assert.rejects(() => store.get('../escape'), /canonical sha256 content address/u);
  assert.throws(() => contentAddressedEvidenceKey('UPPERCASE'), /lowercase hexadecimal/u);
});

test('enforces canonical keys and concurrent duplicate idempotency', async () => {
  const { store } = await createStore();
  const first = evidence(new TextEncoder().encode('first'));
  const second = evidence(new TextEncoder().encode('second'));
  const key = contentAddressedEvidenceKey(first.sha256);

  const concurrent = await Promise.all(Array.from({ length: 8 }, () => store.put(key, first)));
  assert.equal(concurrent.filter((result) => result.created).length, 1);
  assert.equal(concurrent.filter((result) => !result.created).length, 7);
  await assert.rejects(() => store.put(key, second), /key does not match evidence SHA-256/u);
  assertEvidenceEqual(await store.get(key), first);
});

test('detects tampered local evidence bytes, metadata, and content-address mismatch', async () => {
  const { root, store } = await createStore();
  const object = evidence(new TextEncoder().encode('untampered'));
  const key = contentAddressedEvidenceKey(object.sha256);
  await putContentAddressedEvidence(store, object);
  const objectDirectory = path.join(root, key);

  await writeFile(path.join(objectDirectory, 'body'), 'tampered');
  await assert.rejects(() => store.get(key), /does not match supplied SHA-256/u);

  await writeFile(path.join(objectDirectory, 'body'), object.body);
  const metadata = JSON.parse(await readFile(path.join(objectDirectory, 'metadata.json'), 'utf8')) as { contentType: string; sha256: string };
  await writeFile(path.join(objectDirectory, 'metadata.json'), JSON.stringify({ ...metadata, sha256: '0'.repeat(64) }));
  await assert.rejects(() => store.get(key), /does not match supplied SHA-256/u);

  const replacement = evidence(new TextEncoder().encode('coordinated replacement'));
  await writeFile(path.join(objectDirectory, 'body'), replacement.body);
  await writeFile(path.join(objectDirectory, 'metadata.json'), JSON.stringify({ contentType: replacement.contentType, sha256: replacement.sha256 }));
  await assert.rejects(() => store.get(key), /key does not match evidence SHA-256/u);
});
