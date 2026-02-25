# Sera Kest Context

Current mission: Support RedKeepers M0/M1 execution in the `frontend` lane.

Preferred model: codex-5.3 (standard reasoning).

Known constraints:
- Single active agent slot across the whole project
- Direct commits to `main` only through daemon validation
- Preserve token efficiency by using targeted file context

Visual implementation policy (current phase):
- Use placeholder art only (temporary icons, silhouettes, labeled boxes, stock-safe placeholders if needed)
- Build UI/components so art assets can be swapped later without refactoring logic
- Do not wait for final art to progress client UX, layout, or interaction work
