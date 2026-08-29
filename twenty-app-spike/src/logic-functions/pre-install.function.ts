import { definePreInstallLogicFunction } from 'twenty-sdk/define';
import { type InstallPayload } from 'twenty-sdk/logic-function';

export const preInstallHandler = async (payload: InstallPayload) => {
  console.log('[mhoo-core-spike] pre-install', {
    previousVersion: payload.previousVersion ?? null,
    newVersion: payload.newVersion,
  });
};

export default definePreInstallLogicFunction({
  universalIdentifier: '311ccf3e-0308-402f-afdf-4cf0e5969757',
  name: 'pre-install',
  description: 'Disposable lifecycle receipt before metadata migration.',
  timeoutSeconds: 30,
  handler: preInstallHandler,
});
