# app

Process bootstrap and composition root placeholders.

Framework-agnostic composition contracts live here so modules can be wired via interfaces before a runtime stack is chosen:

- `composition.ts`: module registration/bootstrap interfaces, service registry contract, lifecycle hooks
- `reference/`: temporary in-memory reference adapters and a bootstrap smoke helper for contract validation
- `transport/`: concrete local-RPC route wiring for first-slice settlement loop endpoint handlers
- `index.ts`: app-layer contract exports

Concrete config loading, transport startup, and infra adapter wiring remain deferred.
