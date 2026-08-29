import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { SECURITY_SENTINEL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export const securitySentinelHandler = async (
  _payload: unknown,
  context: LogicFunctionExecutionContext,
) => ({
  workspaceId: context.workspaceId,
  syntheticSentinelVisible:
    typeof process.env.MHOO_SYNTHETIC_SENTINEL === 'string' &&
    process.env.MHOO_SYNTHETIC_SENTINEL.length > 0,
});

export default defineLogicFunction({
  universalIdentifier: SECURITY_SENTINEL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'security-sentinel',
  description:
    'Reports only whether a task-specific synthetic parent environment value is visible.',
  timeoutSeconds: 10,
  handler: securitySentinelHandler,
  httpRouteTriggerSettings: {
    path: '/security-sentinel',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
