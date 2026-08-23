import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  sha256FromContentAddressedEvidenceKey,
  verifyEvidenceObjectAtKey,
  type EvidenceObject,
  type EvidenceStore,
} from './evidence-store';

function safeObjectPath(rootDirectory: string, objectKey: string): string {
  const resolvedRoot = path.resolve(rootDirectory);
  const resolvedObject = path.resolve(resolvedRoot, objectKey);

  if (!resolvedObject.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Evidence object key escapes the configured local store');
  }

  return resolvedObject;
}

export class LocalFilesystemEvidenceStore implements EvidenceStore {
  public constructor(private readonly rootDirectory: string) {}

  public async exists(key: string): Promise<boolean> {
    sha256FromContentAddressedEvidenceKey(key);
    try {
      await stat(safeObjectPath(this.rootDirectory, key));
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
      throw error;
    }
  }

  public async get(key: string): Promise<EvidenceObject | undefined> {
    sha256FromContentAddressedEvidenceKey(key);
    const objectDirectory = safeObjectPath(this.rootDirectory, key);

    try {
      const [body, encodedMetadata] = await Promise.all([
        readFile(path.join(objectDirectory, 'body')),
        readFile(path.join(objectDirectory, 'metadata.json'), 'utf8'),
      ]);
      const metadata = JSON.parse(encodedMetadata) as Pick<EvidenceObject, 'contentType' | 'sha256'>;
      const object = { body, contentType: metadata.contentType, sha256: metadata.sha256 };
      verifyEvidenceObjectAtKey(key, object);
      return object;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
      throw error;
    }
  }

  public async put(key: string, object: EvidenceObject): Promise<{ created: boolean }> {
    verifyEvidenceObjectAtKey(key, object);
    const objectDirectory = safeObjectPath(this.rootDirectory, key);
    const temporaryDirectory = `${objectDirectory}.pending-${randomUUID()}`;
    await mkdir(path.dirname(objectDirectory), { recursive: true });

    try {
      await mkdir(temporaryDirectory);
      await Promise.all([
        writeFile(path.join(temporaryDirectory, 'body'), object.body),
        writeFile(path.join(temporaryDirectory, 'metadata.json'), JSON.stringify({
          contentType: object.contentType,
          sha256: object.sha256,
        })),
      ]);
      await rename(temporaryDirectory, objectDirectory);
      return { created: true };
    } catch (error: unknown) {
      // A directory rename onto an already-published non-empty object differs
      // slightly by filesystem: macOS reports EEXIST and some POSIX filesystems
      // report ENOTEMPTY. Both mean an immutable object won the race.
      if (!(error instanceof Error && 'code' in error && (error.code === 'EEXIST' || error.code === 'ENOTEMPTY'))) throw error;

      const existing = await this.get(key);
      if (!existing || existing.sha256 !== object.sha256 || existing.contentType !== object.contentType || !Buffer.from(existing.body).equals(Buffer.from(object.body))) {
        throw new Error('Evidence key is immutable and already contains different content');
      }
      return { created: false };
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}
