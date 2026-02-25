# Vertical Slice Done v1

This file defines a binary release gate for RedKeepers first vertical slice.

Status meaning:
- `PASS`: gate satisfied and evidenced.
- `FAIL`: gate not satisfied or evidence missing.
- `N/A`: not applicable only when explicitly allowed below.

## Gate Set (All Mandatory)

### 1) Playable Loop Gate
Must pass:
- Client shell opens in browser and shows settlement + map + event feed.
- Resource/tick progression is observable.
- At least one building upgrade can start and complete.
- At least one unit type can be trained.
- Map supports at least one interaction flow (select/scout/inspect).
- At least one foreign map settlement/profile exists.
- Player can send one attack to a foreign target.
- Combat resolves (simplified deterministic/placeholder is acceptable) and emits event/log outcome.

### 2) Scope Gate
Must pass:
- First-slice constraints in `docs/design/first-vertical-slice.md` remain intact.
- Placeholder art policy remains intact (no dependency on final art pipeline).
- Out-of-scope features are deferred into follow-up tasks, not merged into slice implementation.

### 3) Quality Gate
Must pass:
- Golden-path smoke run succeeds for the full slice loop (including one attack/resolve flow).
- Required test/validation commands for slice candidate are green.
- No actionable critical blockers remain open in active backlog state.

### 4) Platform Gate (B: Moderate)
Must pass:
- Web build/run path is reproducible and documented.
- Steam wrapper lane scaffold exists with reproducible commands (launch verification optional).
- Android wrapper lane scaffold exists with reproducible commands (device/store release optional).
- Platform checklist marks wrapper assets/metadata as placeholder-only and non-blocking.

### 5) Release Readiness Gate
Must pass:
- Slice checklist exists and is filled for current candidate.
- Known issues are documented with severity/owner.
- One command/runbook exists to reproduce the slice candidate locally.

## Player Identity/Login Position for v1

For this gate set:
- Required: a stable local player identity/profile within dev environment (guest/local is acceptable).
- Optional (post-slice unless explicitly promoted): full account auth/register/login/session flows.

If cross-device persistence is declared in-scope, login/auth becomes mandatory and this document must be revised to `v1.1`.
