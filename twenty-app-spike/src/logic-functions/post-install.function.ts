import { definePostInstallLogicFunction } from 'twenty-sdk/define';
import { type InstallPayload } from 'twenty-sdk/logic-function';

export const postInstallHandler = async (payload: InstallPayload) => {
  console.log('[mhoo-core-spike] post-install', {
    previousVersion: payload.previousVersion ?? null,
    newVersion: payload.newVersion,
  });
};

export default definePostInstallLogicFunction({
  universalIdentifier: '26c14e47-545c-48e8-a8a7-c1be61b34fd7',
  name: 'post-install',
  description: 'Disposable lifecycle receipt after metadata migration.',
  timeoutSeconds: 30,
  handler: postInstallHandler,
  shouldRunSynchronously: true,
  shouldRunOnVersionUpgrade: true,
});
