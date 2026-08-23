import { createHash } from 'node:crypto';
import { mkdir, open, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { EvidenceObject, EvidenceStore } from './evidence-store';

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
    try {
      await stat(safeObjectPath(this.rootDirectory, key));
      return true;
    } catch {
      return false;
    }
  }

  public async get(key: string): Promise<EvidenceObject | undefined> {
    const objectPath = safeObjectPath(this.rootDirectory, key);

    try {
      const body = await readFile(objectPath);
      return {
        body,
        contentType: 'application/octet-stream',
        sha256: createHash('sha256').update(body).digest('hex'),
      };
    } catch {
      return undefined;
    }
  }

  public async put(key: string, object: EvidenceObject): Promise<{ created: boolean }> {
    const actualHash = createHash('sha256').update(object.body).digest('hex');
    if (actualHash !== object.sha256) {
      throw new Error('Evidence body does not match supplied SHA-256');
    }

    const objectPath = safeObjectPath(this.rootDirectory, key);
    await mkdir(path.dirname(objectPath), { recursive: true });

    try {
      const handle = await open(objectPath, 'wx');
      await handle.close();
      await writeFile(objectPath, object.body);
      return { created: true };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        return { created: false };
      }

      throw error;
    }
  }
}
