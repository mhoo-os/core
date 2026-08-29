import { describe, expect, it } from 'vitest';

import { deterministicUuid, sha256 } from 'src/domain/deterministic-id';

describe('deterministic identity', () => {
  it('produces stable UUIDv4-shaped ids without random state', () => {
    const first = deterministicUuid('document', 'source/item/42');
    const second = deterministicUuid('document', 'source/item/42');

    expect(first).toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(deterministicUuid('document', 'source/item/43')).not.toBe(first);
  });

  it('produces stable SHA-256 provenance identities', () => {
    expect(sha256('synthetic')).toBe(
      'b3cc0475bb78a5026098858e9889acf666d31062d513d303314eca31d36e72f2',
    );
  });
});
