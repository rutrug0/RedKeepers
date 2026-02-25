# combat

Placeholder module boundary for the M1 modular monolith scaffold.

Layer responsibilities:
- `api/`: HTTP handlers/controllers and DTO mapping
- `application/`: use cases, commands/queries, orchestration
- `domain/`: entities, value objects, rules, domain services
- `ports/`: repository/external service interfaces
- `infra/`: adapters and implementations behind ports
