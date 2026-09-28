# Changelog

All notable changes to `@comfyorg/comfy-multi-player` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this package uses semantic versioning.

## Unreleased

## 0.3.7 - 2026-09-26

### Added

- Consume every option of a dynamic combo from the catalog's `dynamic_combos`
  map, so option sub-widgets (including nested dynamic combos and options other
  than the default) can be named, validated, minted, written and projected.
  Writes to a child of an inactive option are accepted, and a selector write
  changes no stored values: option defaults are applied at read time, so the
  result does not depend on the order ops arrive in (#240).

### Changed

- `project(mint(w, catalog), catalog)` now fills the selected option's
  defaults for sub-widget slots `w` does not carry, matching how the frontend
  loads such a node. Schema section 7 defines `canonical(w)` accordingly (#240).

### Fixed

- A legacy overflow slot (`_extra_N`) keeps projecting after a selector write
  instead of making the node unprojectable; the selected option's child takes
  that position while it is active (#240).
- `applyConnect` rejects a non-string `grow.inputcount.widget` before any slot
  growth, so a refused op leaves the document unchanged (#240).

## 0.3.6 - 2026-09-23

### Added

- Support `add_node` inside a subgraph definition via a non-empty instance
  `path`, with path-scoped LWW identity, deterministic interior node ordering,
  shared-definition protection, and explicit missing-container rejection.

### Fixed

- Resolve a definition's own interior node `type` (and `properties.proxyWidgets`
  interior-id references) against its sibling scope when the nested-children
  scope has no match, so a subgraph instance nested inside another subgraph's
  own type — the flat-sibling shape litegraph's real serializer
  (`LGraph.asSerialisable()` / `findUsedSubgraphIds()`) actually emits — now
  remaps correctly instead of leaving the raw blueprint id un-remapped and
  falling back to a plain, widget-less node in ComfyUI_frontend's materializer
  (#253).

## 0.3.5 - 2026-09-23

### Fixed

- Declared `structuredClone` as an ambient global in `src/global.d.ts` instead
  of relying on a consumer's resolved `@types/node` version or the `"DOM"`
  lib. TypeScript only knows about `structuredClone`'s type via
  `lib.dom.d.ts`/`lib.webworker.d.ts`, or via `@types/node`'s `web-globals`
  module, which only later `@types/node` releases ship. A toolchain that
  resolves an older `@types/node` with no `"DOM"` in `lib` (this package's own
  `tsconfig.json` has `lib: ["ES2022"]`) hit `TS2304: Cannot find name
  'structuredClone'` across `applier.ts`, `project.ts`, `mint.ts`,
  `compact.ts`, and `doc.ts`, even though the function is present at runtime
  in Node >=17 and every evergreen browser. The declaration coexists with
  `@types/node`'s own when a newer version is resolved, and does not add
  `"DOM"` to `lib`, which would conflict with this package's `check:purity`
  guard against DOM globals leaking into the Node-side build.

## 0.3.4 - 2026-09-23

### Fixed

- Mint genuine numeric link IDs for `insert_workflow` instead of folding them
  into strings. Link IDs are now derived purely from immutable operation
  content (`op_id`, graph scope, and raw link ID) via SHA-256 folded into the
  full JavaScript safe-integer range, matching the branded-number `LinkId`
  type ComfyUI_frontend expects and removing the reproducible collisions the
  prior 32-bit string-folding workaround produced (ADR-033).

### Changed

- `insert_workflow` link-ID derivation no longer reads document state or
  retries against already-present IDs, so replicas applying colliding
  operations in different arrival orders still assign the same ID.

## 0.3.3 - 2026-09-22

### Fixed

- Keep nodes inserted by `insert_workflow` editable and remap promoted-widget
  references to their renamed interior nodes, preserving reserved IO sentinels.
- Measure benchmark apply operations against fresh documents rather than
  already-applied operations.

### Added

- Typed per-field node metadata operations with independent conflict ordering.
- `readApplied()` for inspecting the applied-operation ledger.
- `compact()` for creating a fresh document lineage while retaining conflict
  stamps, node incarnations, link state and clock reservations. Hosts still own
  replica cutover; publishing this helper does not enable compaction in consumers.
- Regression coverage for duplicate-create convergence and CLI-created Note
  nodes, plus a document-growth benchmark matrix.

## 0.3.2 - 2026-09-21

### Fixed

- Republishes the 0.3.1 release, which never reached npm: the tag was never
  pushed, so the version bump landed on `main` without a corresponding package
  publish. 0.3.2 carries the same `insert_workflow` fix as 0.3.1 (see below)
  and is published through the new label-gated release automation.

## 0.3.1 - 2026-09-21

### Fixed

- Fixed `insert_workflow` remap dropping a pasted subgraph definition's
  promoted-input and exposed-output `linkIds`. The synthetic IO node
  sentinels a promoted input resolves against were being treated as missing
  nodes during dangling-link dropping, so every sentinel-fed link was
  discarded and the promoted widget silently stopped being recognized after
  an insert.

## 0.3.0 - 2026-09-19

### Changed

- Breaking: advances the published package from document schema 2 to schema 4.
  Durable link state lives in `__link_state`, and Lamport reservations now live
  in `__clock_reservations`, separate from the winning write-target stamps
  returned by `readStamps()`.
- Old document layouts are refused without mutation. `migrate()` validates the
  current layout; it does not upgrade or relabel schemas 1–3. Hosts must
  re-mint source workflows into a new lineage and settle or discard old pending
  queues before a coordinated consumer cutover. Publication alone does not
  authorize that cutover or establish frontend rollout sign-off.

### Added

- Added the standalone `insert_workflow` op for atomic workflow-template
  insertion. The applier derives every carried node, link, group, and
  definition ID from the operation ID and graph scope, avoiding allocation
  against mutable document state.
- Recovered standalone link, definition, scoped interior-connect, operation
  inspection, and checked public operation-type surfaces.

### Fixed

- Hardened stamp admission, opaque-widget projection, hostile snapshot keys,
  definition identities, interior link preservation, and draft-07 event-schema
  compatibility.
- Restored standalone package gates and release retry verification. Existing
  npm versions are reused only when artifact integrity and verified provenance
  match the tagged source; different bytes must use a new version.

## 0.2.0 - 2026-08-30

### Changed

- Breaking: replaced the 0.1.0 `ApplyResult` shape with ADR-007's ordered,
  discriminated per-op `outcomes` records and renamed `version` to `ops_seen`.
- Added ADR-008's caller-owned event sink contract so hosts can receive
  structured cmp events without a package-global registry or telemetry
  dependency.
- Exported the agent event schema surface from `src/index.ts`, including
  `AGENT_EVENT_JSON_SCHEMA`, `CMP_EVENT_SCHEMA_VERSION`, and event types.
- Added the ADR-011 replay-never-wipe reconnect contract to the 0.2.0 surface:
  reconnects continue from document state and state-vector delta replay instead
  of replacing follower documents during ordinary catch-up.
- Added ADR-021's `DocDerivedLamportClockStore`, deriving Lamport floors from
  the caller-owned document's committed `__stamps` ledger rather than package
  process state.

## 0.1.0 - 2026-08-13

### Added

- Initial op-based CRDT applier for Comfy workflow graph edits.
- Stamp-based conflict identity and idempotent op replay keyed by `op_id`.
- Catalog SHA binding at mint time for deterministic widget projection.
- Read-only snapshot and projection surfaces for consumers that need workflow
  JSON without direct document mutation.
