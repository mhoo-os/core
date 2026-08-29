import { describe, expect, it } from 'vitest';

import {
  buildStressPagePayload,
  SINGLE_FIXTURE_ID,
  STRESS_FIXTURE_ID,
  validatePageJobPayload,
  validateSingleFixtureRequest,
  validateStressFixtureRequest,
} from 'src/domain/synthetic-fixture';

describe('bounded fixture validation', () => {
  it('accepts only the exact single-fixture envelope', () => {
    expect(() =>
      validateSingleFixtureRequest({ fixtureId: SINGLE_FIXTURE_ID }),
    ).not.toThrow();
    expect(() =>
      validateSingleFixtureRequest({
        fixtureId: SINGLE_FIXTURE_ID,
        providerUrl: 'https://provider.invalid',
      }),
    ).toThrow(/Only the synthetic fixture/);
    expect(() =>
      validateSingleFixtureRequest({ fixtureId: 'provider-production' }),
    ).toThrow(/Only the synthetic fixture/);
  });

  it('accepts only the exact stress-fixture envelope', () => {
    expect(() =>
      validateStressFixtureRequest({ fixtureId: STRESS_FIXTURE_ID }),
    ).not.toThrow();
    expect(() => validateStressFixtureRequest(null)).toThrow(
      /Only the synthetic fixture/,
    );
  });

  it('rejects page envelopes that can escape the bounded fixture', () => {
    const payload = buildStressPagePayload(100);

    expect(validatePageJobPayload(payload)).toEqual(payload);
    expect(() =>
      validatePageJobPayload({ ...payload, total: 1_001 }),
    ).toThrow(/bounded fixture/);
    expect(() =>
      validatePageJobPayload({ ...payload, pageSize: 200 }),
    ).toThrow(/bounded fixture/);
    expect(() =>
      validatePageJobPayload({ ...payload, providerToken: 'forbidden' }),
    ).toThrow(/bounded fixture/);
  });
});
