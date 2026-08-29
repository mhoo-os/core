# Mhoo Core Twenty SDK feasibility spike

This is a disposable, unmerged architecture proof. It is not a production
Core implementation, a deployment input, or a provider integration.

The app deliberately uses only custom domain objects:

- `knowledgeSource`
- `syncRun`
- `document`

It proves an authenticated fixture route, app-scoped permissions, generated
REST/GraphQL clients, relations, deterministic IDs, unique indexes, a
1,000-record paginated job, retry/restart/checkpoint behavior, a database
event, a recovery cron, and install/uninstall hooks.

The spike keeps the architectural invariant that Core does not reason. It
stores deterministic synthetic state and evidence identity only. Twenty
remains the human identity, authorization, and Workspace lifecycle authority.

## Deliberate limits

- The only accepted inputs are two fixed local synthetic fixture IDs.
- There are no provider calls, credentials, production data, R2 writes,
  embeddings, model calls, agents, deployment files, or publishing workflow.
- Raw-artifact fields contain synthetic object-key/hash references; no external
  object store is mutated.
- The checkpoint write and enqueue of the next job are not atomic. Idempotent
  replay and a cron repair sweep narrow this gap but do not make Twenty's queue
  equivalent to the existing transactional Core proof.
- The security sentinel returns only a boolean. It exists to test whether the
  LOCAL logic-function driver can see a task-specific parent environment value.

See [SETUP.md](SETUP.md) for the disposable test requirements.
