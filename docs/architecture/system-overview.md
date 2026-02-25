# System Overview

RedKeepers uses a local Python head daemon to coordinate autonomous AI agents in a single execution slot.

## Core Components

- `tools/orchestrator.py`: daemon loop, scheduling, state persistence
- `coordination/backlog/*.json`: queue state and history
- `coordination/policies/*.yaml`: routing/model/retry/commit policies
- `agents/*`: role instructions and persistent context

## Scheduling Model

Only one agent runs at a time. The daemon selects the highest priority dependency-ready item and invokes a Codex CLI subprocess for the assigned agent.
