import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import {
  contentAddressedEvidenceKey,
  putContentAddressedEvidence,
  type EvidenceObject,
  type EvidenceStore,
} from '../src/storage/evidence-store';
import { LocalFilesystemEvidenceStore } from '../src/storage/local-filesystem-evidence-store';
import { S3EvidenceStore } from '../src/storage/s3-evidence-store';

const endpoint = process.env.PHASE0D_S3_ENDPOINT ?? 'http://127.0.0.1:59000';
const localCredentials = {
  accessKeyId: process.env.PHASE0D_S3_ACCESS_KEY_ID ?? 'phase0-local-only',
  secretAccessKey: process.env.PHASE0D_S3_SECRET_ACCESS_KEY ?? 'phase0-local-only-secret',
};

function evidence(body: Uint8Array, contentType = 'application/octet-stream'): EvidenceObject {
  return { body, contentType, sha256: createHash('sha256').update(body).digest('hex') };
}

function assertProof(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEvidenceEqual(actual: EvidenceObject | undefined, expected: EvidenceObject, message: string): void {
  assertProof(actual !== undefined, message);
  assert.deepEqual(new Uint8Array(actual.body), expected.body, message);
  assertProof(actual.contentType === expected.contentType, message);
  assertProof(actual.sha256 === expected.sha256, message);
}

async function proveContract(label: string, store: EvidenceStore): Promise<void> {
  const object = evidence(new Uint8Array([0, 1, 2, 255, 10, 77]));
  const key = contentAddressedEvidenceKey(object.sha256);
  const first = await putContentAddressedEvidence(store, object);
  const duplicate = await putContentAddressedEvidence(store, object);
  assertProof(first.key === key && first.created, `${label}: deterministic first write failed`);
  assertProof(!duplicate.created, `${label}: duplicate write was not idempotent`);
  assertEvidenceEqual(await store.get(key), object, `${label}: bytes or metadata changed on get`);
  assertProof(await store.exists(key), `${label}: object does not exist after put`);
  assert.equal(await store.get(contentAddressedEvidenceKey('0'.repeat(64))), undefined, `${label}: missing object was returned`);

  const concurrent = evidence(new Uint8Array([77, 10, 255, 2, 1, 0]));
  const concurrentKey = contentAddressedEvidenceKey(concurrent.sha256);
  const concurrentResults = await Promise.all(Array.from({ length: 8 }, () => store.put(concurrentKey, concurrent)));
  assert.equal(concurrentResults.filter((result) => result.created).length, 1, `${label}: concurrent write created duplicate state`);
  assert.equal(concurrentResults.filter((result) => !result.created).length, 7, `${label}: concurrent duplicate writes were not idempotent`);

  const conflicting = evidence(new TextEncoder().encode('different object'));
  await assert.rejects(
    () => store.put(key, conflicting),
    /key does not match evidence SHA-256/u,
    `${label}: non-canonical write was accepted`,
  );
  await assert.rejects(
    () => store.put(key, { ...object, sha256: '0'.repeat(64) }),
    /does not match supplied SHA-256/u,
    `${label}: invalid integrity claim was accepted`,
  );
  console.log(`PHASE0D_PROOF ${label} contract-complete`);
}

async function main(): Promise<void> {
  const filesystemRoot = await mkdtemp(path.join(tmpdir(), 'mhoo-phase0d-'));
  const bucket = `mhoo-phase0d-${randomUUID()}`;
  const client = new S3Client({ endpoint, region: 'us-east-1', forcePathStyle: true, credentials: localCredentials });
  let bucketCreated = false;

  try {
    await proveContract('filesystem', new LocalFilesystemEvidenceStore(filesystemRoot));

    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    bucketCreated = true;
    const s3Store = new S3EvidenceStore(client, bucket);
    await proveContract('minio-s3', s3Store);

    const tamperedBody = new TextEncoder().encode('tampered outside EvidenceStore');
    const original = evidence(new TextEncoder().encode('integrity check'));
    const integrityKey = contentAddressedEvidenceKey(original.sha256);
    await s3Store.put(integrityKey, original);
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: integrityKey,
      Body: tamperedBody,
      ContentType: original.contentType,
      Metadata: { sha256: evidence(tamperedBody).sha256 },
    }));
    await assert.rejects(() => s3Store.get(integrityKey), /key does not match evidence SHA-256/u, 'minio-s3: coordinated tampering was not detected');
    console.log('PHASE0D_PROOF minio-s3 coordinated-integrity-complete');
    console.log(JSON.stringify({
      verdict: {
        'DETERMINISTIC CONTENT ADDRESS': 'PASS',
        'CONTENT-ADDRESS BINDING': 'PASS',
        'BYTE-EXACT PUT/GET': 'PASS',
        'IDEMPOTENT DUPLICATE WRITE': 'PASS',
        'CONCURRENT DUPLICATE WRITE': 'PASS',
        'INTEGRITY VERIFICATION': 'PASS',
        'IMMUTABLE CONFLICT': 'PASS',
        'LOCAL S3 COMPATIBILITY': 'PASS',
        'EVIDENCESTORE SCOPE': 'PASS',
      },
      scope: 'local filesystem plus loopback-only MinIO; no Cloudflare credentials or remote storage',
    }));
  } finally {
    if (bucketCreated) {
      const objects = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
      const identifiers = objects.Contents?.flatMap((object) => object.Key ? [{ Key: object.Key }] : []) ?? [];
      if (identifiers.length > 0) {
        await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: identifiers, Quiet: true } }));
      }
      await client.send(new DeleteBucketCommand({ Bucket: bucket }));
    }
    await rm(filesystemRoot, { recursive: true, force: true });
    client.destroy();
  }
}

void main();
