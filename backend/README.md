# Backend Scaffold (M1 Bootstrap)

This directory contains the initial framework-agnostic backend source tree scaffold for the modular monolith described in `docs/architecture/backend-modular-monolith.md`.

## Mapping to the Architecture Spec

- `src/app/`: process bootstrap, dependency wiring, config, and transport startup entrypoints (deferred implementation)
- `src/shared/`: shared primitives and cross-cutting utilities used by modules
- `src/modules/`: module boundaries for the planned M1 module set

Each module follows the repeatable internal layout from the architecture document:

- `api/`
- `application/`
- `domain/`
- `ports/`
- `infra/`

## Deferred Framework Choice

No web framework, ORM, or DI container is selected in this scaffold. The initial `src/shared/*` and `src/app/*` files define typed primitives and composition contracts only, so implementation can proceed without coupling the layout to a runtime stack yet.
