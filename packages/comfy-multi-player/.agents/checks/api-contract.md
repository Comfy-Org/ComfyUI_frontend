# API-contract review

Catch breaking changes to this package's public surface. Applies to `src/index.ts`, exported types, the op vocabulary, the wire envelope, and `schema_version`/`catalog_version` handling.

## What to check

1. **Public exports** — `src/index.ts` re-exports `applyOps`, `project`, `mint`, `migrate`, and everything from `types`, `stamps`, and `doc`. A removed or renamed export without a compatibility alias is a breaking change for both consumers (the browser and the Node doc host). New exports are fine.
2. **Op vocabulary** — op kind names, required fields, and the frozen/deferred sets are a contract shared with the server. Renaming an op kind, adding a required field to an existing op, or moving an op between frozen and deferred is breaking; cite the vocabulary section.
3. **Wire envelope** — the `{ type, data }` shape and `data.v` protocol version are cross-repo. Changing an existing message type, its payload shape, or bumping `data.v` without a documented migration is breaking.
4. **Stamp/order contract** — the total order key `[base_version, actor, op_id]` and `ApplyResult` shape (`applied`, `skipped`, `failed`, `version`) are consumed downstream; narrowing or reshaping them is breaking.
5. **Schema/catalog versioning** — bump `SCHEMA_VERSION` when an old reader would mis-project a new doc, and keep a `migrate()` path (KA-11). Silently changing on-doc shape without a version bump is a breaking, fail-open change.
6. **Type narrowing / default changes** — an exported function that used to accept a wider input now rejecting part of it, or a changed default, can break callers.

## Rules

- Only flag changes that break existing consumers; do not flag additions.
- Check for a re-export alias or `migrate()` path before flagging.
- Do not treat `__`-prefixed internal doc keys as public API.
- Critical for removed/renamed exports or op kinds; high for changed signatures or wire shapes; medium for changed defaults. Cite the affected KA-*/FC-* ID where relevant.
