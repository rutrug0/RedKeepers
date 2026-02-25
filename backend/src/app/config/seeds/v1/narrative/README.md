# Narrative Seed Format (V1 Placeholder)

Status: replaceable placeholder content for M1 integration only.

This folder provides machine-readable narrative placeholder seeds so client/backend can consume stable keys and tokenized templates without parsing markdown.

## Core Required Row Fields

All narrative rows in the JSON tables in this folder include:

- `key`: stable content key (dot-delimited identifier)
- `slice_status_scope`: first-slice scope flag (`playable_now`, `balance_stub`, `data_stub_post_slice`)
- `categories`: category tags for filtering/routing
- `related_ids`: typed selectors or references (`civ_id:...`, `building_id:...`, `resource_id:*`, etc.)
- `template`: renderable string (literal text or tokenized template)
- `tokens`: ordered unique token names used by `template` (empty array if none)

## Token Rules

- Token syntax in `template` is `{token_name}`.
- `tokens` stores names without braces.
- `tokens` order follows first appearance in `template`.
- `tokens` may be empty for literal placeholders (for example civilization intro copy and starter settlement names).

## Validation Shape

Use `narrative-template-table.schema.json` to validate the common table/row structure for the three M1 narrative tables in this folder.
