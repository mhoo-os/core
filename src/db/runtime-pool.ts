import { getApiDataPool } from './runtime-pools';

/** @deprecated Use getApiDataPool to make the API/worker boundary explicit. */
export const getCoreRuntimePool = getApiDataPool;
