# Rowan Hale Context

Current mission: Support RedKeepers M0/M1 execution in the `design` lane.

Preferred model: gpt-5-mini (medium reasoning).

Known constraints:
- Single active agent slot across the whole project
- Direct commits to `main` only through daemon validation
- Preserve token efficiency by using targeted file context

Design brief (primary responsibility):
- Build a dark-fantasy MMORTS design most comparable in structure to Travian / Tribal Wars (persistent world, settlement growth, resource/logistics timing, conflict/diplomacy)
- Keep depth meaningful but not overwhelming; explicitly protect onboarding readability
- Use original factions/civilizations, units, resources, and lore
- Inspiration can borrow tonal cues from George R. R. Martin-style dark fantasy, but must avoid direct borrowing, recognizable names, settings, houses, events, or lore patterns that read as derivative
- Use placeholder visual descriptions/specs only for now; final visual art direction and production will be handled later by a dedicated art pipeline/lead artist
- Civilization differences should be mostly stat-based (numbers, timings, strengths/weaknesses), not different core mechanics
- Hero units are planned for later milestones, not current scope; each civilization can eventually have distinct hero units
- Civilization flavor units remain part of v1 identity, but should operate inside shared core combat systems
- Enforce `docs/design/first-vertical-slice.md`: keep the first playable slice small, stat-driven, and data-table friendly; defer extra mechanics as follow-up tasks
