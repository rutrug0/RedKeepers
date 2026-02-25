# Backend Modular Monolith (Initial Direction)

The backend starts as a single deployable service (one process, one runtime) with strict internal module boundaries. The goal is fast M1 delivery without locking the project into a tightly-coupled codebase.

## Goals (M1)

- Single service deployable with clear internal domain boundaries
- Server-authoritative game state for world/economy/combat actions
- HTTP API contracts defined for client integration
- In-process module integration via interfaces/events (no external broker required yet)
- Persistence schema direction defined for initial implementation

## Non-Goals (M1)

- Microservice deployment split
- Horizontal shard architecture
- Final performance tuning of simulation/combat loops
- Full observability/analytics platform

## Planned Module Set

Core gameplay/domain modules for M1 direction:

- `auth`
- `player`
- `settlement`
- `world_map`
- `economy`
- `buildings`
- `units`
- `combat`
- `events`
- `telemetry`

## Modular Monolith Shape

Recommended backend package layout (framework-agnostic):

```text
backend/
  src/
    app/                # process bootstrap, DI wiring, config, transport startup
    shared/             # common primitives (ids, time, result/error types)
    modules/
      auth/
      player/
      settlement/
      world_map/
      economy/
      buildings/
      units/
      combat/
      events/
      telemetry/
```

Per-module internal layout (repeatable convention):

```text
modules/<module>/
  api/                  # HTTP handlers/controllers + DTO mapping
  application/          # use cases, commands/queries, orchestration
  domain/               # entities, value objects, domain services, rules
  ports/                # repository and external service interfaces
  infra/                # DB implementations, adapters
```

## Dependency Rules

- Modules may depend on `shared/*`.
- Modules do not read/write another module's tables directly.
- Cross-module interaction happens via:
  - application service interfaces (synchronous query/command)
  - in-process domain/integration events (async within process)
- `api` layer only calls its own module application services.
- `infra` implementations stay behind `ports` interfaces.

## Module Boundaries and Interfaces (Initial)

### `auth`

Responsibility:
- Account identity, login/session/token issuance, authz claims assembly

Owns data (initial):
- accounts
- auth_identities (provider linkage)
- refresh_tokens / sessions

Inbound interfaces:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Outbound interfaces (ports/events):
- `PlayerProvisioningPort.createPlayerForAccount(accountId)`
- Publishes `Auth.AccountRegistered`, `Auth.LoginSucceeded`

Notes:
- `auth` authenticates accounts; player progression/profile lives in `player`.

### `player`

Responsibility:
- Player profile, progression metadata, account-to-player mapping, roster ownership view

Owns data (initial):
- players
- player_profiles
- player_progression

Inbound interfaces:
- `GET /players/me`
- `PATCH /players/me/profile`

Outbound interfaces:
- `SettlementReadPort.getPrimarySettlement(playerId)`
- `UnitsReadPort.listOwnedUnits(playerId)`
- Consumes `Auth.AccountRegistered` to create default player record

### `settlement`

Responsibility:
- Settlement state aggregate, queueable actions scoped to a settlement, ownership validation

Owns data (initial):
- settlements
- settlement_state_snapshots (optional in M1, can be deferred)

Inbound interfaces:
- `GET /settlements/{settlementId}`
- `GET /settlements/{settlementId}/overview`

Outbound interfaces:
- `BuildingsReadPort.listBuildings(settlementId)`
- `EconomyReadPort.getSettlementResources(settlementId)`
- `UnitsReadPort.listGarrison(settlementId)`

### `world_map`

Responsibility:
- World tiles/regions, exploration visibility, node occupancy, movement path validation inputs

Owns data (initial):
- world_tiles
- map_regions
- tile_ownership_or_control (if needed before combat)
- exploration_state

Inbound interfaces:
- `GET /world-map/viewport`
- `GET /world-map/tiles/{tileId}`

Outbound interfaces:
- `UnitsPositionPort.getUnitStackPositions(...)`
- `CombatReadPort.getActiveBattlesInArea(...)`
- Publishes `WorldMap.TileControlChanged`

### `economy`

Responsibility:
- Resource balances, production/consumption resolution, transaction ledger, affordability checks

Owns data (initial):
- resource_accounts (per settlement/player scope)
- resource_ledger_entries
- production_jobs (if modeled explicitly)

Inbound interfaces:
- `GET /economy/settlements/{settlementId}/resources`
- `POST /economy/settlements/{settlementId}/reserve` (server/internal use; can stay internal-only in M1)

Outbound interfaces:
- `BuildingsReadPort.getProductionModifiers(settlementId)`
- `UnitsReadPort.getUpkeep(settlementId|playerId)`
- Publishes `Economy.ResourcesChanged`, `Economy.InsufficientResources`

Key internal service contracts:
- `EconomyService.canAfford(scopeId, costBundle) -> bool`
- `EconomyService.applyTransaction(scopeId, txSpec) -> LedgerResult`
- `EconomyService.tickSettlementEconomy(settlementId, tickTime) -> EconomyTickResult`

### `buildings`

Responsibility:
- Building definitions (runtime-loaded), construction queue/state, building effects

Owns data (initial):
- building_instances
- building_construction_queue

Inbound interfaces:
- `POST /settlements/{settlementId}/buildings/queue`
- `GET /settlements/{settlementId}/buildings`

Outbound interfaces:
- `EconomyCommandPort.reserveCost(...)`
- `EconomyCommandPort.consumeReservedCost(...)`
- Publishes `Buildings.ConstructionQueued`, `Buildings.ConstructionCompleted`

### `units`

Responsibility:
- Unit definitions (runtime-loaded), instances, training queue, movement orders, roster state

Owns data (initial):
- unit_instances
- unit_training_queue
- unit_orders

Inbound interfaces:
- `GET /units/{unitId}`
- `POST /settlements/{settlementId}/units/train`
- `POST /units/{unitId}/orders/move`

Outbound interfaces:
- `EconomyCommandPort.reserveCost(...)`
- `WorldMapCommandPort.validatePath(...)`
- `CombatCommandPort.enqueueEngagementCheck(...)`
- Publishes `Units.UnitCreated`, `Units.UnitMoved`, `Units.UnitDestroyed`

### `combat`

Responsibility:
- Battle creation, combat resolution, battle state progression, result application

Owns data (initial):
- battles
- battle_participants
- battle_rounds (or battle_events log)
- combat_results

Inbound interfaces:
- `GET /combat/battles/{battleId}`
- `POST /combat/engagements` (internal/admin/testing; public API may be deferred)

Outbound interfaces:
- `UnitsCommandPort.applyCasualties(...)`
- `WorldMapCommandPort.applyTileControl(...)`
- `EventsPort.recordGameEvent(...)`
- Publishes `Combat.BattleStarted`, `Combat.BattleResolved`

Key internal service contracts:
- `CombatService.tryStartEngagement(location, participants) -> BattleStartResult`
- `CombatService.resolveBattleStep(battleId, tickTime) -> CombatStepResult`
- `CombatService.finalizeBattle(battleId) -> BattleResolution`

### `events`

Responsibility:
- Player-facing event feed aggregation and durable event records (game events, battle outcomes, construction completion)

Owns data (initial):
- game_events
- player_event_inbox (optional projection; can be deferred)

Inbound interfaces:
- `GET /events/feed`
- `POST /events/ack` (optional M1)

Outbound interfaces:
- Consumes integration events from `economy`, `buildings`, `units`, `combat`, `world_map`

### `telemetry`

Responsibility:
- Structured operational metrics/log emission and gameplay telemetry capture hooks

Owns data (initial):
- No required OLTP tables in M1 (prefer logs/metrics sink abstraction)

Inbound interfaces:
- Internal-only instrumentation API (no public HTTP required for M1)

Outbound interfaces:
- `MetricsPort.increment(...)`
- `MetricsPort.observe(...)`
- `AuditLogPort.write(...)`

## Cross-Module Interface Contracts (Minimum M1 Set)

These interfaces are the required seams to keep module boundaries intact while staying in one process:

- `Auth -> Player`: account registration triggers player bootstrap
- `Buildings -> Economy`: reserve/consume/refund resource costs
- `Units -> Economy`: reserve/consume training costs and upkeep application hooks
- `Units -> WorldMap`: path validation and tile occupancy checks
- `Units -> Combat`: engagement checks when hostile stacks converge
- `Combat -> Units`: casualty and state updates after resolution
- `Combat -> WorldMap`: territorial control updates after battle
- `All gameplay modules -> Events`: publish player-visible outcomes

Recommended integration style in M1:

- Synchronous commands/queries: direct interface calls through injected ports
- Integration events: in-process event bus with handler registration and transactional outbox pattern deferred

## API Surface (M1 Bootstrap Scope)

M1 should expose a narrow authenticated API, enough to exercise module seams:

- Auth/session endpoints (`auth`)
- Player profile endpoint (`player`)
- Settlement overview endpoint (`settlement` + composed reads)
- Resource view endpoint (`economy`)
- Building queue/list endpoints (`buildings`)
- Unit train/list/move endpoints (`units`)
- Battle read endpoint (`combat`)
- Event feed endpoint (`events`)

Composition rule:
- Cross-module response composition is done in application services (or dedicated query handlers), not by bypassing ownership boundaries.

## Persistence Schema Direction (Initial)

Initial storage model (single database):

- One relational database for all modules (schema-per-module optional; table prefix acceptable initially)
- Tables logically owned by modules, even if stored in same DB
- Shared columns conventions:
  - `id` (UUID/ULID)
  - `created_at`
  - `updated_at`
  - `version` (optimistic concurrency where needed)

Suggested naming examples:

- `auth_accounts`, `auth_sessions`
- `player_profiles`
- `settlement_settlements`
- `world_map_tiles`
- `economy_resource_accounts`, `economy_ledger_entries`
- `buildings_instances`
- `units_instances`, `units_orders`
- `combat_battles`, `combat_rounds`
- `events_game_events`

## Tick / Simulation Boundaries (M1)

Server-side simulation remains authoritative and modular:

- `economy` tick: production, consumption, upkeep application
- `buildings` tick: construction queue progress
- `units` tick: training queue progress, movement order advancement
- `combat` tick: battle step resolution

Proposed orchestration:

- `app` hosts a single scheduler/tick runner
- Tick runner invokes module application services in deterministic order:
  1. `economy`
  2. `buildings`
  3. `units`
  4. `combat`
  5. `events` projection refresh (if needed)
- Tick interval is configurable (exact cadence deferred; see decisions below)

## M1 Bootstrap Implementation Steps

1. Create backend service scaffold
- Add `backend/src/app`, `backend/src/shared`, `backend/src/modules/*` directories
- Add module template structure (`api/application/domain/ports/infra`) for all planned modules
- Add config loader and process entrypoint

2. Define shared primitives and contracts
- IDs, clock abstraction, result/error envelope, auth context principal
- In-process event bus interface and minimal implementation
- Transaction boundary abstraction (`UnitOfWork` or equivalent)

3. Implement module port interfaces (empty adapters first)
- Repository interfaces for `auth`, `player`, `economy`, `units`, `combat`, `world_map`
- Cross-module ports listed in this spec
- DTOs/command/query objects for M1 endpoints

4. Add HTTP transport and route registration
- Health endpoint
- Auth middleware
- Route groups mapped to module `api` packages
- Request/response validation and error mapping

5. Implement persistence foundation
- DB connection + migrations framework
- Initial tables for `auth`, `player`, `settlement`, `economy`, `buildings`, `units`, `combat`, `events`
- Repository adapters for basic create/read/update flows

6. Implement minimum vertical slices (end-to-end)
- Register/login -> create player -> create starter settlement/resources
- Settlement overview read (composed across settlement/buildings/economy/units)
- Queue building with resource reservation
- Queue unit training with resource reservation
- Move unit order validation against world map

7. Implement first server tick runner
- Configurable loop + locking guard (single process)
- Economy/buildings/units/combat module tick hooks (can be no-op except one implemented path)
- Structured logs and telemetry counters for tick duration/failures

8. Seed data and test harness
- Static content seed for buildings/units/resources/map tiles
- Integration tests for module boundary flows
- Developer bootstrap script for local DB + service run

## Assumptions (Current)

- One backend deployable process is sufficient for M1 concurrency/load.
- Backend is server-authoritative for gameplay state transitions.
- One primary relational database is available for M1.
- Client communication is HTTP/JSON first; real-time push can be deferred.
- Internal event delivery can remain in-process for M1 without external queue durability.
- Static game data (unit/building definitions) can be loaded from versioned files or seed tables at startup.

## Deferred Decisions

- Final backend language/framework/runtime choice (document is layout/contract oriented)
- Authentication strategy details (JWT vs opaque sessions, external IdP support)
- DB vendor and migration tooling selection
- Exact tick cadence and deterministic replay requirements
- WebSocket/SSE push vs polling for event/battle updates
- Schema-per-module vs shared schema with prefixes
- Transactional outbox/event durability for cross-process delivery
- Content data source of truth (files vs DB-managed admin tooling)
- Matchmaking/PvP concurrency model and battle lock strategy
- Anti-cheat validation depth beyond server-authoritative action checks

## M1 Deliverable Check (for RK-M1-0001)

- Module boundaries and interfaces listed: Yes (all planned modules, with auth/world/economy/combat detailed)
- M1 bootstrap implementation steps defined: Yes
- Assumptions and deferred decisions documented: Yes
