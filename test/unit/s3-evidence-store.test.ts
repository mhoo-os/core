import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

import { contentAddressedEvidenceKey } from '../../src/storage/evidence-store';
import { S3EvidenceStore } from '../../src/storage/s3-evidence-store';

test('retries a transient S3 conditional-write conflict', async () => {
  const body = new TextEncoder().encode('retry conditional write');
  const sha256 = createHash('sha256').update(body).digest('hex');
  let putAttempts = 0;
  const client = {
    send: async (command: unknown) => {
      assert.ok(command instanceof PutObjectCommand);
      putAttempts += 1;
      if (putAttempts === 1) throw { $metadata: { httpStatusCode: 409 } };
      return {};
    },
  } as unknown as S3Client;
  const store = new S3EvidenceStore(client, 'local-test-bucket');

  assert.deepEqual(await store.put(contentAddressedEvidenceKey(sha256), {
    body,
    contentType: 'text/plain',
    sha256,
  }), { created: true });
  assert.equal(putAttempts, 2);
});
