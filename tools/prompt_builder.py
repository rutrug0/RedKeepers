from __future__ import annotations

from pathlib import Path
from typing import Any

from schemas import utc_now_iso


def _safe_read(path: Path, max_chars: int = 4000) -> str:
    if not path.exists() or not path.is_file():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    if len(text) > max_chars:
        return text[:max_chars] + "\n...[truncated]..."
    return text


def build_prompt(
    project_root: Path,
    *,
    agent_id: str,
    agent_cfg: dict[str, Any],
    work_item: dict[str, Any],
) -> str:
    agent_dir = project_root / "agents" / agent_id
    agent_md = _safe_read(agent_dir / "AGENT.md", max_chars=5000)
    agent_skill = _safe_read(agent_dir / "SKILL.md", max_chars=5000)
    agent_context = _safe_read(agent_dir / "context.md", max_chars=5000)
    working_notes = _safe_read(agent_dir / "working-notes.md", max_chars=2500)

    role = str(agent_cfg.get("role", "")).strip().lower()
    shared_ui_style = ""
    frontend_scope_rule = ""
    if role == "frontend":
        shared_ui_style = _safe_read(project_root / "docs" / "design" / "ui-style-guide.md", max_chars=5000)
        frontend_scope_rule = (
            "- Keep UI implementation aligned with `docs/design/ui-style-guide.md`; "
            "consistency of shared tokens/components is mandatory.\n"
        )

    input_sections: list[str] = []
    for ref in work_item.get("inputs", [])[:8]:
        ref_path = project_root / ref
        content = _safe_read(ref_path, max_chars=2500)
        if content:
            input_sections.append(f"## {ref}\n\n{content}")
        else:
            input_sections.append(f"## {ref}\n\n[missing or non-file]")

    acceptance = "\n".join(f"- {line}" for line in work_item.get("acceptance_criteria", []))
    validations = "\n".join(f"- {line}" for line in work_item.get("validation_commands", []))

    prompt = f"""# RedKeepers Autonomous Agent Task

Timestamp (UTC): {utc_now_iso()}
Agent: {agent_cfg['display_name']} ({agent_cfg['role']})
Agent ID: {agent_id}

## Role Boundaries
{agent_md}

## Agent Skill
{agent_skill or "[No agent-specific skill file]"}

## Current Context
{agent_context}

## Working Notes (recent summary)
{working_notes}

## Work Item
ID: {work_item['id']}
Title: {work_item['title']}
Milestone: {work_item['milestone']}
Type: {work_item['type']}
Priority: {work_item['priority']}

Description:
{work_item['description']}

Acceptance Criteria:
{acceptance or '- None provided'}

Validation Commands:
{validations or '- None'}

## Relevant Inputs
{chr(10).join(input_sections) if input_sections else '[No input files listed]'}

## Shared UI Style Guide
{shared_ui_style or '[Not applicable for this role]'}

## Output Requirements
- Start your final response with one explicit status line: `STATUS: COMPLETED` or `STATUS: BLOCKED`.
- Respect the first vertical slice scope (`docs/design/first-vertical-slice.md`). If you identify useful but out-of-scope work, defer it into `proposed_work_items` rather than implementing it now.
- Keep outputs concise and implementation-focused.
{frontend_scope_rule}- Make only the changes needed for this work item.
- If blocked, explain the blocker clearly and propose follow-up tasks.
- If you identify follow-up work, append/update your `agents/{agent_id}/outbox.json` entry for this item with a `proposed_work_items` array (structured tasks for daemon ingestion).
- `proposed_work_items` entries should include at minimum: `title`, `owner_role`, `description`, `acceptance_criteria` (array). Optional: `priority`, `dependencies`, `inputs`, `validation_commands`, `milestone`.
- Summarize changed files and results at the end.
- Do not print long chain-of-thought; provide concise action/results.
"""
    return prompt
