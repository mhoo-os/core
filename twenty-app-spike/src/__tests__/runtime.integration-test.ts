import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import {
  RestApiClient,
  RestApiClientError,
} from 'twenty-client-sdk/rest';
import { describe, expect, it } from 'vitest';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { deterministicUuid, sha256 } from 'src/domain/deterministic-id';
import {
  buildStressPagePayload,
  SINGLE_FIXTURE_ID,
  STRESS_FIXTURE_ID,
  STRESS_RECORD_COUNT,
} from 'src/domain/synthetic-fixture';

const apiUrl = process.env.TWENTY_API_URL as string;
const apiKey = process.env.TWENTY_API_KEY as string;
const rest = new RestApiClient({ baseUrl: apiUrl, token: apiKey });

type RouteResult = Record<string, unknown>;
type RestEnvelope = {
  data: Record<string, unknown>;
  totalCount?: number;
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
};

const getRestRecord = (
  response: unknown,
  key: string,
): Record<string, unknown> => {
  const record = (response as RestEnvelope).data[key];

  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    throw new Error(`Missing REST record data.${key}`);
  }

  return record as Record<string, unknown>;
};

const delay = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const getWithRateLimitRecovery = async <TResponse>(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): Promise<TResponse> => {
  const deadline = Date.now() + 65_000;

  while (true) {
    try {
      return await rest.get<TResponse>(path, { query });
    } catch (error) {
      if (
        !(error instanceof RestApiClientError) ||
        error.status !== 429 ||
        Date.now() >= deadline
      ) {
        throw error;
      }

      await delay(1_000);
    }
  }
};

const waitForCompletedRun = async (
  runId: string,
): Promise<Record<string, unknown>> => {
  const deadline = Date.now() + 12 * 60 * 1_000;

  while (Date.now() < deadline) {
    const response = await getWithRateLimitRecovery<unknown>(
      `/rest/syncRuns/${runId}`,
    );
    const run = getRestRecord(response, 'syncRun');

    if (run.status === 'COMPLETED') {
      return run;
    }

    await delay(2_000);
  }

  throw new Error(`Sync run ${runId} did not complete within 12 minutes`);
};

const waitForCronReceipt = async (): Promise<RouteResult> => {
  const deadline = Date.now() + 90_000;
  let lastResult: RouteResult = {};

  while (Date.now() < deadline) {
    lastResult = await getWithRateLimitRecovery<RouteResult>('/s/proof-state');

    if (lastResult.recoveryCronObserved === true) {
      return lastResult;
    }

    await delay(2_000);
  }

  return lastResult;
};

describe('Mhoo Core Twenty App runtime proof', () => {
  it('is installed with the expected universal identity', async () => {
    const metadata = new MetadataApiClient({
      url: `${apiUrl}/metadata`,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const result = await metadata.query({
      findManyApplications: {
        id: true,
        universalIdentifier: true,
      },
    });

    expect(
      result.findManyApplications.some(
        (application: { universalIdentifier: string }) =>
          application.universalIdentifier === APPLICATION_UNIVERSAL_IDENTIFIER,
      ),
    ).toBe(true);
  });

  it('exposes the synthetic LOCAL environment leak without returning its value', async () => {
    const result = await rest.get<RouteResult>('/s/security-sentinel');

    expect(result).toEqual(
      expect.objectContaining({ syntheticSentinelVisible: true }),
    );
    expect(JSON.stringify(result)).not.toContain(
      process.env.MHOO_SYNTHETIC_SENTINEL ?? 'sentinel-value-not-in-test-process',
    );
  });

  it('ingests one fixture and reads it through REST and the generated typed client', async () => {
    const routeResult = await rest.post<RouteResult>('/s/ingest-fixture', {
      fixtureId: SINGLE_FIXTURE_ID,
    });
    const sourceId = String(routeResult.sourceId);
    const runId = String(routeResult.runId);
    const documentId = String(routeResult.documentId);

    expect(routeResult.outcome).toBe('completed');

    const sourceResponse = await rest.get(`/rest/knowledgeSources/${sourceId}`);
    const runResponse = await rest.get(`/rest/syncRuns/${runId}`);
    const documentResponse = await rest.get(`/rest/documents/${documentId}`);

    expect(getRestRecord(sourceResponse, 'knowledgeSource')).toMatchObject({
      id: sourceId,
      provider: 'synthetic-local',
    });
    expect(getRestRecord(runResponse, 'syncRun')).toMatchObject({
      id: runId,
      status: 'COMPLETED',
      cursor: 1,
    });
    expect(getRestRecord(documentResponse, 'document')).toMatchObject({
      id: documentId,
      sourceId,
      syncRunId: runId,
    });

    const typedClient = new CoreApiClient({
      url: `${apiUrl}/graphql`,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const typedResult = await typedClient.query({
      knowledgeSources: {
        __args: { filter: { id: { eq: sourceId } }, first: 1 },
        edges: { node: { id: true, sourceKey: true, provider: true } },
      },
    });

    expect(typedResult.knowledgeSources?.edges?.[0]?.node).toMatchObject({
      id: sourceId,
      provider: 'synthetic-local',
    });
  });

  it('denies generated typed writes to an unassigned API key', async () => {
    const typedClient = new CoreApiClient({
      url: `${apiUrl}/graphql`,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const id = deterministicUuid('integration-source', 'typed-client-crud');
    const sourceUri = 'mhoo-synthetic://typed-client-crud';

    await expect(
      typedClient.mutation({
        createKnowledgeSource: {
          __args: {
            data: {
              id,
              sourceKey: 'synthetic/local/typed-client-crud',
              displayName: 'Typed client CRUD',
              provider: 'synthetic-local',
              sourceUri,
              revision: '1',
              provenanceHash: sha256(sourceUri),
            },
          },
          id: true,
        },
      }),
    ).rejects.toThrow(/not writable through the API/);
  });

  it('retries, resumes, checkpoints, and deduplicates 1,000 records', async () => {
    const start = await rest.post<RouteResult>('/s/start-stress-fixture', {
      fixtureId: STRESS_FIXTURE_ID,
    });
    const runId = String(start.runId);

    expect(start.outcome).toBe('started');
    expect(runId).toBe(buildStressPagePayload(0).runId);

    const completedRun = await waitForCompletedRun(runId);

    expect(completedRun).toMatchObject({
      status: 'COMPLETED',
      cursor: STRESS_RECORD_COUNT,
      processedCount: STRESS_RECORD_COUNT,
    });

    const firstPage = await getWithRateLimitRecovery<RestEnvelope>(
      '/rest/documents',
      { limit: 200 },
    );
    const logicalKeys = new Set<string>();
    const seenCursors = new Set<string>();
    let response = firstPage;

    while (true) {
      const records = response.data.documents as Record<string, unknown>[];

      for (const record of records) {
        logicalKeys.add(String(record.logicalKey));
      }

      if (!response.pageInfo?.hasNextPage || !response.pageInfo.endCursor) {
        break;
      }

      if (seenCursors.has(response.pageInfo.endCursor)) {
        throw new Error('REST pagination returned a repeated end cursor');
      }

      seenCursors.add(response.pageInfo.endCursor);

      response = await getWithRateLimitRecovery<RestEnvelope>(
        '/rest/documents',
        {
          limit: 200,
          starting_after: response.pageInfo.endCursor,
        },
      );
    }

    expect(firstPage.totalCount).toBe(STRESS_RECORD_COUNT + 1);
    expect(logicalKeys.size).toBe(STRESS_RECORD_COUNT + 1);

    const proofState = await waitForCronReceipt();

    expect(proofState).toMatchObject({
      syntheticFailureInjected: true,
      sourceCreatedEventObserved: true,
      recoveryCronObserved: true,
    });

    const restart = await rest.post<RouteResult>('/s/start-stress-fixture', {
      fixtureId: STRESS_FIXTURE_ID,
    });

    expect(restart).toMatchObject({
      outcome: 'already-completed',
      runId,
      cursor: STRESS_RECORD_COUNT,
    });

    const finalCount = await getWithRateLimitRecovery<RestEnvelope>(
      '/rest/documents',
      { limit: 1 },
    );

    expect(finalCount.totalCount).toBe(STRESS_RECORD_COUNT + 1);
  });
});
