# Architecture decision records

- [ADR-0001: Core execution architecture and async tenancy](0001-execution-architecture.md)
  defines the Core/PostgreSQL/pg-boss boundary, the future Inngest tripwires,
  and trusted tenant job envelopes.

Cross-repository Core authority decisions remain in `mhoo` ADR-0003 and
ADR-0004. Core implementation records preserve Twenty as the sole authority
for human identity and Workspace lifecycle.
