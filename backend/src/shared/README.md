# shared

Shared primitives and cross-cutting backend utilities used across modules.

Starter stubs are kept framework-agnostic and typed so modules can depend on contracts now:

- `ids.ts`: branded ID primitives and ID codec interface
- `result.ts`: shared `Result`/`AppError` types
- `time.ts`: clock abstraction (`Clock`)
- `events.ts`: in-process event bus interface and event envelope types
- `index.ts`: shared exports
