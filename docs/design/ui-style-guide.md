# UI Style Guide (First Vertical Slice)

This guide defines the shared frontend style system. Consistency is the top priority.

## Core Principles
- System first: reuse shared tokens/components before creating variants.
- Cohesion first: each screen should feel part of one product family.
- Distinctive but controlled: allow one signature moment per screen, never a new style system.

## Design Tokens
- Typography
  - `--font-display: "Bebas Neue", "Oswald", sans-serif;`
  - `--font-body: "Source Sans 3", "Barlow", sans-serif;`
- Type scale
  - `--text-xs: 12px`
  - `--text-sm: 14px`
  - `--text-md: 16px`
  - `--text-lg: 20px`
  - `--text-xl: 28px`
  - `--text-2xl: 40px`
- Spacing scale
  - `--space-1: 4px`
  - `--space-2: 8px`
  - `--space-3: 12px`
  - `--space-4: 16px`
  - `--space-5: 24px`
  - `--space-6: 32px`
  - `--space-7: 48px`
- Color tokens
  - `--bg-0: #12110f`
  - `--bg-1: #1b1916`
  - `--panel: #25211c`
  - `--text-0: #f3efe6`
  - `--text-1: #c9c0af`
  - `--accent: #c75b2a`
  - `--accent-2: #e3a23b`
  - `--danger: #b23a2f`
  - `--ok: #3f8f5f`
- Radius and shadow
  - `--radius-sm: 6px`
  - `--radius-md: 10px`
  - `--radius-lg: 14px`
  - `--shadow-panel: 0 10px 30px rgba(0, 0, 0, 0.35)`

## Layout & Components
- Base layout: dark atmospheric background, layered panels, strong section hierarchy.
- Buttons: same radii, font treatment, and hover timing across the app.
- Forms: consistent label size, field height, and validation colors.
- Cards/panels: use shared border, radius, and shadow tokens only.

## Motion Rules
- Standard duration: 140ms to 220ms for hover/focus.
- Page/section reveal: 240ms to 420ms with subtle stagger.
- Motion should support hierarchy and feedback, not decoration overload.

## Banned Patterns
- Default/system font stacks as final UI.
- Purple-on-white gradient defaults and generic template aesthetics.
- New ad-hoc palette per screen.
- Mixing unrelated style languages in one flow.

## PR/Task Checklist
- Uses shared tokens for typography, spacing, color, and motion.
- Preserves existing component patterns.
- Works on desktop and mobile.
- Meets basic keyboard/focus accessibility.
- Includes visual smoke diff when environment allows.
