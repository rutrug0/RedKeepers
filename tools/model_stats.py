from __future__ import annotations

from pathlib import Path
from typing import Any

from schemas import load_json, save_json_atomic, utc_now_iso


def _default_totals() -> dict[str, Any]:
    return {
        "runs": 0,
        "completed": 0,
        "blocked": 0,
        "failed": 0,
        "fallback_runs": 0,
        "requested_model_mismatch_runs": 0,
        "tokens_in": 0,
        "tokens_out": 0,
        "runtime_seconds": 0.0,
    }


def _default_model_bucket() -> dict[str, Any]:
    return {
        **_default_totals(),
        "first_seen_at": None,
        "last_used_at": None,
        "agents": {},
    }


def _default_session(*, started_at: str, pid: int, mode: str) -> dict[str, Any]:
    return {
        "started_at": started_at,
        "ended_at": None,
        "pid": pid,
        "mode": mode,
        "totals": _default_totals(),
        "by_model": {},
    }


class ModelStatsTracker:
    def __init__(self, root: Path):
        self.root = root
        self.path = root / "coordination" / "runtime" / "model-stats.json"

    def default_payload(self) -> dict[str, Any]:
        return {
            "generated_at": utc_now_iso(),
            "lifetime": {
                "totals": _default_totals(),
                "by_model": {},
            },
            "sessions": {},
            "session_order": [],
        }

    def load(self) -> dict[str, Any]:
        data = load_json(self.path, None)
        if not isinstance(data, dict):
            data = self.default_payload()

        data.setdefault("generated_at", utc_now_iso())
        data.setdefault("lifetime", {})
        data["lifetime"].setdefault("totals", _default_totals())
        data["lifetime"].setdefault("by_model", {})
        data.setdefault("sessions", {})
        data.setdefault("session_order", [])
        return data

    def save(self, data: dict[str, Any]) -> None:
        data["generated_at"] = utc_now_iso()
        save_json_atomic(self.path, data)

    def start_session(
        self,
        data: dict[str, Any],
        *,
        session_id: str,
        started_at: str,
        pid: int,
        mode: str,
    ) -> None:
        sessions = data.setdefault("sessions", {})
        if session_id not in sessions:
            sessions[session_id] = _default_session(started_at=started_at, pid=pid, mode=mode)
            order = data.setdefault("session_order", [])
            if session_id not in order:
                order.append(session_id)
        else:
            sessions[session_id].setdefault("started_at", started_at)
            sessions[session_id]["pid"] = pid
            sessions[session_id]["mode"] = mode
            sessions[session_id]["ended_at"] = None

    def end_session(self, data: dict[str, Any], *, session_id: str, ended_at: str) -> None:
        session = data.setdefault("sessions", {}).get(session_id)
        if isinstance(session, dict):
            session["ended_at"] = ended_at

    def _bump_totals(
        self,
        bucket: dict[str, Any],
        *,
        outcome: str,
        fallback_used: bool,
        requested_model: str | None,
        used_model: str | None,
        tokens_in: int,
        tokens_out: int,
        runtime_seconds: float,
    ) -> None:
        bucket["runs"] = int(bucket.get("runs", 0)) + 1
        if outcome == "completed":
            bucket["completed"] = int(bucket.get("completed", 0)) + 1
        elif outcome == "blocked":
            bucket["blocked"] = int(bucket.get("blocked", 0)) + 1
        else:
            bucket["failed"] = int(bucket.get("failed", 0)) + 1

        if fallback_used:
            bucket["fallback_runs"] = int(bucket.get("fallback_runs", 0)) + 1

        if requested_model and used_model and requested_model != used_model:
            bucket["requested_model_mismatch_runs"] = int(bucket.get("requested_model_mismatch_runs", 0)) + 1

        bucket["tokens_in"] = int(bucket.get("tokens_in", 0)) + max(0, int(tokens_in))
        bucket["tokens_out"] = int(bucket.get("tokens_out", 0)) + max(0, int(tokens_out))
        bucket["runtime_seconds"] = float(bucket.get("runtime_seconds", 0.0)) + max(0.0, float(runtime_seconds))

    def _ensure_model_bucket(self, by_model: dict[str, Any], model_name: str, *, now: str) -> dict[str, Any]:
        if model_name not in by_model or not isinstance(by_model[model_name], dict):
            by_model[model_name] = _default_model_bucket()
        bucket = by_model[model_name]
        if not bucket.get("first_seen_at"):
            bucket["first_seen_at"] = now
        bucket["last_used_at"] = now
        bucket.setdefault("agents", {})
        return bucket

    def _ensure_agent_bucket(self, model_bucket: dict[str, Any], agent_id: str, role: str | None) -> dict[str, Any]:
        agents = model_bucket.setdefault("agents", {})
        if agent_id not in agents or not isinstance(agents[agent_id], dict):
            agents[agent_id] = {
                **_default_totals(),
                "role": role,
            }
        if role and not agents[agent_id].get("role"):
            agents[agent_id]["role"] = role
        return agents[agent_id]

    def record_run(
        self,
        data: dict[str, Any],
        *,
        session_id: str | None,
        agent_id: str,
        role: str | None,
        outcome: str,
        requested_model: str | None,
        used_model: str | None,
        fallback_used: bool,
        tokens_in: int,
        tokens_out: int,
        runtime_seconds: float,
    ) -> None:
        now = utc_now_iso()
        model_name = (used_model or requested_model or "unknown-model").strip() or "unknown-model"

        lifetime = data.setdefault("lifetime", {})
        lifetime_totals = lifetime.setdefault("totals", _default_totals())
        self._bump_totals(
            lifetime_totals,
            outcome=outcome,
            fallback_used=fallback_used,
            requested_model=requested_model,
            used_model=used_model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            runtime_seconds=runtime_seconds,
        )

        lifetime_by_model = lifetime.setdefault("by_model", {})
        lifetime_model_bucket = self._ensure_model_bucket(lifetime_by_model, model_name, now=now)
        self._bump_totals(
            lifetime_model_bucket,
            outcome=outcome,
            fallback_used=fallback_used,
            requested_model=requested_model,
            used_model=used_model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            runtime_seconds=runtime_seconds,
        )
        lifetime_agent_bucket = self._ensure_agent_bucket(lifetime_model_bucket, agent_id, role)
        self._bump_totals(
            lifetime_agent_bucket,
            outcome=outcome,
            fallback_used=fallback_used,
            requested_model=requested_model,
            used_model=used_model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            runtime_seconds=runtime_seconds,
        )

        if not session_id:
            return

        sessions = data.setdefault("sessions", {})
        session = sessions.get(session_id)
        if not isinstance(session, dict):
            # Late initialization if session was not started for any reason.
            session = _default_session(started_at=now, pid=-1, mode="unknown")
            sessions[session_id] = session
            order = data.setdefault("session_order", [])
            if session_id not in order:
                order.append(session_id)

        session_totals = session.setdefault("totals", _default_totals())
        self._bump_totals(
            session_totals,
            outcome=outcome,
            fallback_used=fallback_used,
            requested_model=requested_model,
            used_model=used_model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            runtime_seconds=runtime_seconds,
        )

        session_by_model = session.setdefault("by_model", {})
        session_model_bucket = self._ensure_model_bucket(session_by_model, model_name, now=now)
        self._bump_totals(
            session_model_bucket,
            outcome=outcome,
            fallback_used=fallback_used,
            requested_model=requested_model,
            used_model=used_model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            runtime_seconds=runtime_seconds,
        )
        session_agent_bucket = self._ensure_agent_bucket(session_model_bucket, agent_id, role)
        self._bump_totals(
            session_agent_bucket,
            outcome=outcome,
            fallback_used=fallback_used,
            requested_model=requested_model,
            used_model=used_model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            runtime_seconds=runtime_seconds,
        )
