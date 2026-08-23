import { createCoreBoss } from '../src/jobs/boss';
import { registerMockIngestionWorker } from '../src/jobs/worker';
import { createWorkerPools } from '../src/db/runtime-pools';

const pools = createWorkerPools();
const boss = createCoreBoss(pools.bossPool);

boss.on('error', (error) => console.error('PHASE0B_WORKER_ERROR', error));
await boss.start();
await registerMockIngestionWorker(boss, pools.workerDataPool);
console.log('PHASE0B_WORKER_READY');

async function shutdown(): Promise<void> {
  await boss.stop({ graceful: false, close: false });
  await Promise.all([pools.bossPool.end(), pools.workerDataPool.end()]);
  process.exit(0);
}

process.once('SIGTERM', () => { void shutdown(); });
process.once('SIGINT', () => { void shutdown(); });
