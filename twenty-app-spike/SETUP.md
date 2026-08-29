# Disposable setup only

Use an isolated Twenty App development container with unique container,
volume, and port names. Do not use the SDK's default `twenty-app-dev`
container or volumes for this proof.

Every SDK CLI or integration-test process must set:

- `MHOO_TWENTY_TEST_HOME` to a task-specific absolute temporary directory;
- `NODE_OPTIONS=--require=<app>/tools/test-home-preload.cjs`;
- `TWENTY_API_URL` to the disposable runtime;
- `TWENTY_API_KEY` to that runtime's synthetic development key.

The preload redirects the SDK's hard-coded `os.homedir()/.twenty` path. Tests
fail closed when the task-specific home is absent, so the user's existing
Twenty CLI configuration is never overwritten.

Validation commands:

```text
yarn lint
yarn typecheck
yarn test:unit
yarn build
yarn test:integration
```

No command in this spike publishes, deploys, or contacts an external provider.
