# app/transport

Concrete transport wiring for app-level contract invocation.

Current runtime adapter:

- `local-first-slice-settlement-loop-transport.ts`: local-RPC route map for the first-slice settlement loop endpoints (tick, building upgrade, unit train, world-map lifecycle advance, world-map hostile settlement attack, world-map march snapshots, world-map scout interaction, world-map neutral gather start/poll)
- `first-slice-settlement-loop-http-host.ts`: deterministic local HTTP host that maps the same route templates to transport handlers for `fetch` clients; run with `node backend/src/app/transport/first-slice-settlement-loop-http-host.ts --host 127.0.0.1 --port 8787`
- `smoke.ts`: smoke helper that invokes a wired route and verifies client-facing contract delivery
