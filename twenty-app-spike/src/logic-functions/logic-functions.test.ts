import { afterEach, describe, expect, it, vi } from 'vitest';

import ingestFixture from 'src/logic-functions/ingest-fixture.function';
import ingestPage from 'src/logic-functions/ingest-page.function';
import onKnowledgeSourceCreated from 'src/logic-functions/on-knowledge-source-created.function';
import recoverSyncRuns from 'src/logic-functions/recover-sync-runs.function';
import securitySentinel, {
  securitySentinelHandler,
} from 'src/logic-functions/security-sentinel.function';
import startStressFixture from 'src/logic-functions/start-stress-fixture.function';
import workspaceProbe from 'src/logic-functions/workspace-probe.function';

describe('logic-function boundaries', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('exposes only authenticated ingress and sentinel routes', () => {
    expect(ingestFixture.config.httpRouteTriggerSettings).toEqual({
      path: '/ingest-fixture',
      httpMethod: 'POST',
      isAuthRequired: true,
    });
    expect(startStressFixture.config.httpRouteTriggerSettings).toEqual({
      path: '/start-stress-fixture',
      httpMethod: 'POST',
      isAuthRequired: true,
    });
    expect(securitySentinel.config.httpRouteTriggerSettings).toEqual({
      path: '/security-sentinel',
      httpMethod: 'GET',
      isAuthRequired: true,
    });
    expect(workspaceProbe.config.httpRouteTriggerSettings).toEqual({
      path: '/workspace-probe',
      httpMethod: 'GET',
      isAuthRequired: true,
    });
  });

  it('uses a bounded background job, database event, and cron repair trigger', () => {
    expect(ingestPage.config).not.toHaveProperty('httpRouteTriggerSettings');
    expect(onKnowledgeSourceCreated.config.databaseEventTriggerSettings).toEqual(
      { eventName: 'knowledgeSource.created' },
    );
    expect(recoverSyncRuns.config.cronTriggerSettings).toEqual({
      pattern: '* * * * *',
    });
  });

  it('never returns the synthetic sentinel value', async () => {
    vi.stubEnv('MHOO_SYNTHETIC_SENTINEL', 'do-not-return-this-value');

    const result = await securitySentinelHandler(
      {},
      {
        retryCount: 0,
        maxRetries: 0,
        workspaceId: 'workspace-proof',
        userWorkspaceId: null,
        workspaceMemberId: null,
      },
    );

    expect(result).toEqual({
      workspaceId: 'workspace-proof',
      syntheticSentinelVisible: true,
    });
    expect(JSON.stringify(result)).not.toContain('do-not-return-this-value');
  });
});
