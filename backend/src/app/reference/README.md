# app/reference

Temporary, framework-agnostic reference implementations for early backend bootstrap validation.

These adapters exist only to exercise the `ServiceRegistry`, `InProcessEventBus`, and module composition contracts before a production runtime stack (web framework/DI container) is selected:

- `in-memory-service-registry.ts`: minimal in-memory `ServiceRegistry` adapter
- `in-memory-event-bus.ts`: minimal in-process pub/sub adapter
- `reference-bootstrap.ts`: simple composition runner that executes module registration and collects lifecycle hooks
- `smoke.ts`: bootstrap smoke helper that composes a placeholder module and validates service/event wiring
