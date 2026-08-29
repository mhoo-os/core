import { defineUninstallLogicFunction } from 'twenty-sdk/define';
import { type UninstallPayload } from 'twenty-sdk/logic-function';

export const uninstallHandler = async (payload: UninstallPayload) => {
  console.log('[mhoo-core-spike] uninstall', {
    version: payload.version ?? null,
  });
};

export default defineUninstallLogicFunction({
  universalIdentifier: '1e01ac4f-69d6-4b03-96f7-d5ffd644841c',
  name: 'uninstall',
  description: 'Best-effort disposable lifecycle receipt before removal.',
  timeoutSeconds: 30,
  handler: uninstallHandler,
});
