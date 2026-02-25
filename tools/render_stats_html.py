from __future__ import annotations

import argparse
import html
from pathlib import Path
from typing import Any

from schemas import load_json


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AGENT_STATS = ROOT / "coordination" / "runtime" / "agent-stats.json"
DEFAULT_MODEL_STATS = ROOT / "coordination" / "runtime" / "model-stats.json"
DEFAULT_OUTPUT = ROOT / "coordination" / "runtime" / "stats-dashboard.html"
DEFAULT_WORK_ITEMS = ROOT / "coordination" / "backlog" / "work-items.json"
DEFAULT_COMPLETED_ITEMS = ROOT / "coordination" / "backlog" / "completed-items.json"
DEFAULT_BLOCKED_ITEMS = ROOT / "coordination" / "backlog" / "blocked-items.json"


def _fmt_int(value: Any) -> str:
    try:
        return f"{int(value):,}"
    except Exception:
        return "0"


def _fmt_float(value: Any, digits: int = 1) -> str:
    try:
        return f"{float(value):,.{digits}f}"
    except Exception:
        return f"{0:.{digits}f}"


def _fmt_duration(seconds: Any) -> str:
    try:
        total = max(0.0, float(seconds))
    except Exception:
        total = 0.0
    minutes = int(total // 60)
    rem = int(total % 60)
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}h {mins:02d}m {rem:02d}s"


def _trim(text: Any, limit: int = 96) -> str:
    raw = str(text or "")
    if len(raw) <= limit:
        return raw
    return raw[: max(0, limit - 3)] + "..."


def _coerce_item_list(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    return [entry for entry in raw if isinstance(entry, dict)]


def _count_by(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for item in items:
        value = str(item.get(key, "unknown") or "unknown")
        counts[value] = counts.get(value, 0) + 1
    rows = [{"label": label, "count": count} for label, count in counts.items()]
    rows.sort(key=lambda row: row["count"], reverse=True)
    return rows


def _render_stat_cards(cards: list[tuple[str, str]]) -> str:
    parts = ['<section class="cards">']
    for label, value in cards:
        parts.append(
            "<article class='card'>"
            f"<h3>{html.escape(label)}</h3>"
            f"<p>{html.escape(value)}</p>"
            "</article>"
        )
    parts.append("</section>")
    return "".join(parts)


def _render_bar_chart(
    *,
    title: str,
    rows: list[dict[str, Any]],
    label_key: str,
    value_key: str,
    value_formatter,
    color_class: str = "bar",
) -> str:
    if not rows:
        return f"<section class='panel'><h2>{html.escape(title)}</h2><p>No data.</p></section>"

    values = []
    for row in rows:
        try:
            values.append(float(row.get(value_key, 0)))
        except Exception:
            values.append(0.0)
    max_value = max(values) if values else 0.0
    max_value = max(max_value, 1.0)

    parts = [f"<section class='panel'><h2>{html.escape(title)}</h2><div class='chart'>"]
    for row, value in zip(rows, values):
        width = max(0.0, min(100.0, (value / max_value) * 100.0))
        label = html.escape(str(row.get(label_key, "unknown")))
        display = html.escape(str(value_formatter(row.get(value_key, 0))))
        parts.append(
            "<div class='bar-row'>"
            f"<div class='bar-label'>{label}</div>"
            "<div class='bar-track'>"
            f"<div class='{color_class}' style='width: {width:.2f}%'></div>"
            "</div>"
            f"<div class='bar-value'>{display}</div>"
            "</div>"
        )
    parts.append("</div></section>")
    return "".join(parts)


def _render_table(headers: list[str], rows: list[list[str]]) -> str:
    parts = ["<div class='table-wrap'><table><thead><tr>"]
    for head in headers:
        parts.append(f"<th>{html.escape(head)}</th>")
    parts.append("</tr></thead><tbody>")
    for row in rows:
        parts.append("<tr>")
        for cell in row:
            parts.append(f"<td>{html.escape(cell)}</td>")
        parts.append("</tr>")
    parts.append("</tbody></table></div>")
    return "".join(parts)


def _render_session_panels(model_stats: dict[str, Any]) -> str:
    sessions = model_stats.get("sessions", {})
    order = list(model_stats.get("session_order", []))
    if not isinstance(sessions, dict):
        return "<section class='panel'><h2>Per Session</h2><p>No session data.</p></section>"

    if not order:
        order = sorted(sessions.keys())

    if not order:
        return "<section class='panel'><h2>Per Session</h2><p>No session data.</p></section>"

    parts = ["<section class='panel'><h2>Per Session Model Usage</h2>"]
    newest = order[-1]
    for session_id in reversed(order):
        session = sessions.get(session_id, {})
        if not isinstance(session, dict):
            continue
        totals = session.get("totals", {})
        by_model = session.get("by_model", {})
        rows: list[dict[str, Any]] = []
        if isinstance(by_model, dict):
            for model_name, entry in by_model.items():
                if isinstance(entry, dict):
                    rows.append({"model": model_name, **entry})
        rows.sort(key=lambda row: int(row.get("runs", 0)), reverse=True)

        card_html = _render_stat_cards(
            [
                ("Session ID", session_id),
                ("Mode", str(session.get("mode", "unknown"))),
                ("PID", _fmt_int(session.get("pid", 0))),
                ("Started", str(session.get("started_at", "n/a"))),
                ("Ended", str(session.get("ended_at", "running"))),
                ("Runs", _fmt_int(totals.get("runs", 0))),
                ("Fallback Runs", _fmt_int(totals.get("fallback_runs", 0))),
                ("Runtime", _fmt_duration(totals.get("runtime_seconds", 0))),
            ]
        )
        table_rows = [
            [
                str(row.get("model", "unknown")),
                _fmt_int(row.get("runs", 0)),
                _fmt_int(row.get("completed", 0)),
                _fmt_int(row.get("blocked", 0)),
                _fmt_int(row.get("failed", 0)),
                _fmt_int(row.get("fallback_runs", 0)),
                _fmt_int(int(row.get("tokens_in", 0)) + int(row.get("tokens_out", 0))),
                _fmt_duration(row.get("runtime_seconds", 0)),
            ]
            for row in rows
        ]
        table_html = _render_table(
            ["Model", "Runs", "Completed", "Blocked", "Failed", "Fallback", "Tokens", "Runtime"],
            table_rows,
        )
        chart_html = _render_bar_chart(
            title=f"Session {session_id} - Runs by Model",
            rows=rows,
            label_key="model",
            value_key="runs",
            value_formatter=_fmt_int,
            color_class="bar alt",
        )
        details_attr = " open" if session_id == newest else ""
        parts.append(
            f"<details class='session'{details_attr}>"
            f"<summary>{html.escape(session_id)}</summary>"
            f"{card_html}{table_html}{chart_html}"
            "</details>"
        )

    parts.append("</section>")
    return "".join(parts)


def _render_backlog_section(
    *,
    queued_items: list[dict[str, Any]],
    completed_items: list[dict[str, Any]],
    blocked_items: list[dict[str, Any]],
) -> str:
    all_items = [*queued_items, *completed_items, *blocked_items]

    by_role_rows = _count_by(all_items, "owner_role")
    by_milestone_rows = _count_by(all_items, "milestone")
    by_type_rows = _count_by(all_items, "type")

    cards = _render_stat_cards(
        [
            ("Queued Items", _fmt_int(len(queued_items))),
            ("Completed Items", _fmt_int(len(completed_items))),
            ("Blocked Items", _fmt_int(len(blocked_items))),
            ("Total Tracked", _fmt_int(len(all_items))),
        ]
    )

    def render_items_table(title: str, items: list[dict[str, Any]]) -> str:
        rows = sorted(items, key=lambda item: str(item.get("updated_at", "")), reverse=True)
        rows = rows[:40]
        table_rows = [
            [
                str(item.get("id", "")),
                _trim(item.get("title", ""), 64),
                str(item.get("owner_role", "")),
                str(item.get("priority", "")),
                str(item.get("milestone", "")),
                _fmt_int(item.get("retry_count", 0)),
                _trim(item.get("blocker_reason", ""), 72),
                str(item.get("updated_at", "")),
            ]
            for item in rows
        ]
        subtitle = f"Showing {len(rows)} of {len(items)} items"
        return (
            "<section class='panel'>"
            f"<h2>{html.escape(title)}</h2>"
            f"<p>{html.escape(subtitle)}</p>"
            + _render_table(
                ["ID", "Title", "Role", "Priority", "Milestone", "Retries", "Blocker", "Updated (UTC)"],
                table_rows,
            )
            + "</section>"
        )

    role_chart = _render_bar_chart(
        title="Work Items by Owner Role",
        rows=by_role_rows,
        label_key="label",
        value_key="count",
        value_formatter=_fmt_int,
        color_class="bar alt2",
    )
    milestone_chart = _render_bar_chart(
        title="Work Items by Milestone",
        rows=by_milestone_rows,
        label_key="label",
        value_key="count",
        value_formatter=_fmt_int,
        color_class="bar alt",
    )
    type_chart = _render_bar_chart(
        title="Work Items by Type",
        rows=by_type_rows,
        label_key="label",
        value_key="count",
        value_formatter=_fmt_int,
    )

    return (
        "<section class='panel'>"
        "<h2>Work Items Backlog</h2>"
        "<p>Queue/completed/blocked backlog state snapshot.</p>"
        "</section>"
        + cards
        + role_chart
        + milestone_chart
        + type_chart
        + render_items_table("Queued Work Items", queued_items)
        + render_items_table("Blocked Work Items", blocked_items)
        + render_items_table("Completed Work Items", completed_items)
    )


def build_html(
    *,
    title: str,
    agent_stats: dict[str, Any],
    model_stats: dict[str, Any],
    queued_items: list[dict[str, Any]],
    completed_items: list[dict[str, Any]],
    blocked_items: list[dict[str, Any]],
) -> str:
    generated_at = model_stats.get("generated_at") or agent_stats.get("generated_at") or "n/a"
    queue_totals = agent_stats.get("totals", {})
    lifetime = model_stats.get("lifetime", {})
    lifetime_totals = lifetime.get("totals", {})
    lifetime_by_model = lifetime.get("by_model", {})

    model_rows: list[dict[str, Any]] = []
    if isinstance(lifetime_by_model, dict):
        for model_name, entry in lifetime_by_model.items():
            if isinstance(entry, dict):
                model_rows.append({"model": model_name, **entry})
    model_rows.sort(key=lambda row: int(row.get("runs", 0)), reverse=True)

    agents = agent_stats.get("agents", {})
    agent_rows: list[dict[str, Any]] = []
    if isinstance(agents, dict):
        for agent_id, entry in agents.items():
            if isinstance(entry, dict):
                agent_rows.append({"agent_id": agent_id, **entry})
    agent_rows.sort(key=lambda row: int(row.get("total_runs", 0)), reverse=True)

    model_table_rows = [
        [
            str(row.get("model", "unknown")),
            _fmt_int(row.get("runs", 0)),
            _fmt_int(row.get("completed", 0)),
            _fmt_int(row.get("blocked", 0)),
            _fmt_int(row.get("failed", 0)),
            _fmt_int(row.get("fallback_runs", 0)),
            _fmt_int(int(row.get("tokens_in", 0)) + int(row.get("tokens_out", 0))),
            _fmt_duration(row.get("runtime_seconds", 0)),
        ]
        for row in model_rows
    ]
    model_table = _render_table(
        ["Model", "Runs", "Completed", "Blocked", "Failed", "Fallback", "Tokens", "Runtime"],
        model_table_rows,
    )

    agent_table_rows = [
        [
            str(row.get("agent_id", "unknown")),
            str(row.get("role", "unknown")),
            _fmt_int(row.get("total_runs", 0)),
            _fmt_int(row.get("completed_items", 0)),
            _fmt_int(row.get("blocked_items", 0)),
            _fmt_int(row.get("failed_runs", 0)),
            _fmt_int(int(row.get("estimated_tokens_in", 0)) + int(row.get("estimated_tokens_out", 0))),
            _fmt_duration(row.get("total_runtime_seconds", 0)),
        ]
        for row in agent_rows
    ]
    agent_table = _render_table(
        ["Agent", "Role", "Runs", "Completed", "Blocked", "Failed", "Tokens", "Runtime"],
        agent_table_rows,
    )

    cards = _render_stat_cards(
        [
            ("Generated (UTC)", str(generated_at)),
            ("Total Runs", _fmt_int(lifetime_totals.get("runs", 0))),
            ("Completed", _fmt_int(lifetime_totals.get("completed", 0))),
            ("Blocked", _fmt_int(lifetime_totals.get("blocked", 0))),
            ("Failed", _fmt_int(lifetime_totals.get("failed", 0))),
            ("Fallback Runs", _fmt_int(lifetime_totals.get("fallback_runs", 0))),
            ("Runtime", _fmt_duration(lifetime_totals.get("runtime_seconds", 0))),
            ("Queue - Queued", _fmt_int(queue_totals.get("queued_items", 0))),
            ("Queue - Blocked", _fmt_int(queue_totals.get("blocked_items", 0))),
            ("Queue - Completed", _fmt_int(queue_totals.get("completed_items", 0))),
        ]
    )

    model_runs_chart = _render_bar_chart(
        title="Global Runs by Model",
        rows=model_rows,
        label_key="model",
        value_key="runs",
        value_formatter=_fmt_int,
    )
    model_tokens_chart = _render_bar_chart(
        title="Global Tokens by Model",
        rows=[{**row, "token_total": int(row.get("tokens_in", 0)) + int(row.get("tokens_out", 0))} for row in model_rows],
        label_key="model",
        value_key="token_total",
        value_formatter=_fmt_int,
        color_class="bar alt",
    )
    agent_runs_chart = _render_bar_chart(
        title="Runs by Agent",
        rows=agent_rows,
        label_key="agent_id",
        value_key="total_runs",
        value_formatter=_fmt_int,
        color_class="bar alt2",
    )
    backlog_section = _render_backlog_section(
        queued_items=queued_items,
        completed_items=completed_items,
        blocked_items=blocked_items,
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(title)}</title>
  <style>
    :root {{
      --bg: #0f1720;
      --panel: #18222e;
      --panel-soft: #223243;
      --text: #edf3fb;
      --muted: #9fb3c8;
      --bar: linear-gradient(90deg, #5eead4, #38bdf8);
      --bar-alt: linear-gradient(90deg, #fbbf24, #fb7185);
      --bar-alt2: linear-gradient(90deg, #86efac, #2dd4bf);
      --border: #2f4256;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      color: var(--text);
      background: radial-gradient(circle at top right, #1f3347 0%, var(--bg) 55%);
    }}
    main {{
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      gap: 16px;
    }}
    h1, h2, h3 {{ margin: 0 0 8px 0; }}
    p {{ margin: 0; color: var(--muted); }}
    .panel {{
      background: color-mix(in srgb, var(--panel) 92%, black);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }}
    .card {{
      background: var(--panel-soft);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      min-height: 88px;
    }}
    .card h3 {{
      font-size: 12px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 8px;
    }}
    .card p {{
      color: var(--text);
      font-size: 18px;
      font-weight: 600;
    }}
    .chart {{
      display: grid;
      gap: 8px;
    }}
    .bar-row {{
      display: grid;
      grid-template-columns: minmax(140px, 240px) 1fr 88px;
      gap: 10px;
      align-items: center;
    }}
    .bar-label {{
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text);
      font-size: 13px;
    }}
    .bar-track {{
      background: #112030;
      border: 1px solid var(--border);
      border-radius: 999px;
      overflow: hidden;
      height: 12px;
    }}
    .bar {{
      height: 100%;
      background: var(--bar);
    }}
    .bar.alt {{ background: var(--bar-alt); }}
    .bar.alt2 {{ background: var(--bar-alt2); }}
    .bar-value {{
      text-align: right;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }}
    .table-wrap {{
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-top: 10px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      min-width: 700px;
      background: #0f1a25;
    }}
    th, td {{
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid #223041;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #142130;
      position: sticky;
      top: 0;
    }}
    details.session {{
      background: #132031;
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-top: 10px;
      padding: 10px;
    }}
    details summary {{
      cursor: pointer;
      font-weight: 700;
      color: #dbeafe;
    }}
  </style>
</head>
<body>
  <main>
    <section class="panel">
      <h1>{html.escape(title)}</h1>
      <p>Global and per-session runtime analytics for RedKeepers autonomous agents.</p>
    </section>
    {cards}
    <section class="panel">
      <h2>Global Model Usage</h2>
      {model_table}
    </section>
    {model_runs_chart}
    {model_tokens_chart}
    <section class="panel">
      <h2>Agent Usage</h2>
      {agent_table}
    </section>
    {agent_runs_chart}
    {_render_session_panels(model_stats)}
    {backlog_section}
  </main>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render RedKeepers runtime stats dashboard HTML.")
    parser.add_argument("--agent-stats", type=Path, default=DEFAULT_AGENT_STATS)
    parser.add_argument("--model-stats", type=Path, default=DEFAULT_MODEL_STATS)
    parser.add_argument("--work-items", type=Path, default=DEFAULT_WORK_ITEMS)
    parser.add_argument("--completed-items", type=Path, default=DEFAULT_COMPLETED_ITEMS)
    parser.add_argument("--blocked-items", type=Path, default=DEFAULT_BLOCKED_ITEMS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--title", default="RedKeepers Runtime Dashboard")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    agent_stats = load_json(args.agent_stats, {})
    model_stats = load_json(args.model_stats, {})
    queued_items_raw = load_json(args.work_items, [])
    completed_items_raw = load_json(args.completed_items, [])
    blocked_items_raw = load_json(args.blocked_items, [])
    if not isinstance(agent_stats, dict):
        agent_stats = {}
    if not isinstance(model_stats, dict):
        model_stats = {}
    queued_items = _coerce_item_list(queued_items_raw)
    completed_items = _coerce_item_list(completed_items_raw)
    blocked_items = _coerce_item_list(blocked_items_raw)

    html_text = build_html(
        title=args.title,
        agent_stats=agent_stats,
        model_stats=model_stats,
        queued_items=queued_items,
        completed_items=completed_items,
        blocked_items=blocked_items,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html_text, encoding="utf-8")
    print(f"Dashboard written: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
