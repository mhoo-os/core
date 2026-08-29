import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const requireEnvironment = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for disposable integration tests`);
  }

  return value;
};

const TWENTY_API_URL = requireEnvironment('TWENTY_API_URL');
const TWENTY_API_KEY = requireEnvironment('TWENTY_API_KEY');

// Make env vars available to globalSetup (test.env only applies to workers)
process.env.TWENTY_API_URL = TWENTY_API_URL;
process.env.TWENTY_API_KEY = TWENTY_API_KEY;

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: ['tsconfig.spec.json'],
      ignoreConfigErrors: true,
    }),
  ],
  test: {
    testTimeout: 900_000,
    hookTimeout: 900_000,
    fileParallelism: false,
    include: ['src/**/*.integration-test.ts'],
    globalSetup: ['src/__tests__/global-setup.ts'],
    env: {
      TWENTY_API_URL,
      TWENTY_API_KEY,
    },
  },
});
