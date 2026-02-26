# app/transport

Concrete transport wiring for app-level contract invocation.

Current runtime adapter:

- `local-first-slice-settlement-loop-transport.ts`: local-RPC route map for the first-slice settlement loop endpoints (tick, building upgrade, unit train, world-map lifecycle advance, world-map march snapshots, world-map scout interaction, world-map neutral gather start/poll)
- `smoke.ts`: smoke helper that invokes a wired route and verifies client-facing contract delivery
