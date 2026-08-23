import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { verifyEvidenceObject, type EvidenceObject, type EvidenceStore } from './evidence-store';

function isStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && '$metadata' in error
    && (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === status;
}

/** S3/R2-compatible adapter; it owns no persistence policy beyond EvidenceStore. */
export class S3EvidenceStore implements EvidenceStore {
  public constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  public async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isStatus(error, 404)) return false;
      throw error;
    }
  }

  public async get(key: string): Promise<EvidenceObject | undefined> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) throw new Error('Evidence object response had no body');
      const object = {
        body: await result.Body.transformToByteArray(),
        contentType: result.ContentType ?? '',
        sha256: result.Metadata?.sha256 ?? '',
      };
      verifyEvidenceObject(object);
      return object;
    } catch (error) {
      if (isStatus(error, 404)) return undefined;
      throw error;
    }
  }

  public async put(key: string, object: EvidenceObject): Promise<{ created: boolean }> {
    verifyEvidenceObject(object);
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: object.body,
        ContentType: object.contentType,
        Metadata: { sha256: object.sha256 },
        IfNoneMatch: '*',
      }));
      return { created: true };
    } catch (error) {
      if (!isStatus(error, 412)) throw error;
      const existing = await this.get(key);
      if (!existing || existing.sha256 !== object.sha256 || existing.contentType !== object.contentType || !Buffer.from(existing.body).equals(Buffer.from(object.body))) {
        throw new Error('Evidence key is immutable and already contains different content');
      }
      return { created: false };
    }
  }
}
