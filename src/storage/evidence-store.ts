import { createHash } from 'node:crypto';

export type EvidenceObject = {
  body: Uint8Array;
  contentType: string;
  sha256: string;
};

export interface EvidenceStore {
  exists(key: string): Promise<boolean>;
  get(key: string): Promise<EvidenceObject | undefined>;
  put(key: string, object: EvidenceObject): Promise<{ created: boolean }>;
}

export type StoredEvidence = {
  key: string;
  sha256: string;
  byteSize: number;
  created: boolean;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export function contentAddressedEvidenceKey(sha256: string): string {
  if (!SHA256_PATTERN.test(sha256)) throw new Error('Evidence SHA-256 must be lowercase hexadecimal');
  return `sha256/${sha256}`;
}

export function verifyEvidenceObject(object: EvidenceObject): void {
  if (!(object.body instanceof Uint8Array)) throw new Error('Evidence body must be bytes');
  if (typeof object.sha256 !== 'string') throw new Error('Evidence SHA-256 must be a string');
  if (typeof object.contentType !== 'string') throw new Error('Evidence content type must be a string');
  if (!SHA256_PATTERN.test(object.sha256)) throw new Error('Evidence SHA-256 must be lowercase hexadecimal');
  if (!object.contentType) throw new Error('Evidence content type is required');

  const actualHash = createHash('sha256').update(object.body).digest('hex');
  if (actualHash !== object.sha256) throw new Error('Evidence body does not match supplied SHA-256');
}

/** Stores bytes under their Mhoo-owned immutable content address. */
export async function putContentAddressedEvidence(
  store: EvidenceStore,
  object: EvidenceObject,
): Promise<StoredEvidence> {
  verifyEvidenceObject(object);
  const key = contentAddressedEvidenceKey(object.sha256);
  const result = await store.put(key, object);
  return { key, sha256: object.sha256, byteSize: object.body.byteLength, created: result.created };
}
