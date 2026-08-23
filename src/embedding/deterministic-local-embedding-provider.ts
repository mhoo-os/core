import { createHash } from 'node:crypto';

import type { EmbeddingProvider } from './embedding-provider';

export class DeterministicLocalEmbeddingProvider implements EmbeddingProvider {
  public readonly dimensions: number;

  public constructor(dimensions = 8) {
    if (!Number.isInteger(dimensions) || dimensions < 2 || dimensions > 64) {
      throw new Error('Deterministic embedding dimensions must be an integer between 2 and 64');
    }

    this.dimensions = dimensions;
  }

  public async embed(text: string): Promise<number[]> {
    const digest = createHash('sha256').update(text, 'utf8').digest();
    const values = Array.from({ length: this.dimensions }, (_, index) => {
      const byte = digest[index % digest.length] ?? 0;
      return (byte / 127.5) - 1;
    });
    const magnitude = Math.hypot(...values);

    return values.map((value) => value / magnitude);
  }
}
