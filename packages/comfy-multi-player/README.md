# @comfyorg/comfy-multi-player

The shared workflow-document package for multi-player ComfyUI: **one
implementation of op→doc semantics used identically by the browser and the
server doc host**. It owns the CRDT document layout (Yjs), the op applier, and
the deterministic projection back to ComfyUI workflow JSON — so every host
that applies the same stamped ops converges on the same document and renders
the same JSON.

## What lives here

- `applyOps(doc, ops, catalog?)` — apply stamped ops: idempotent per `op_id`
  (`__applied`, checked before any mutation), LWW-gated via `__stamps` with
  the exact `[base_version, actor, op_id]` code-point order, delete-wins,
  abort-remainder batches (`ApplyResult.failed = {index, op, code, message}`
  with the applied prefix retained).
- `project(doc, catalog)` — canonical projection to ComfyUI workflow JSON
  (schema §7): nodes/links sorted by id, the name-keyed `widgets` map
  assembled into positional `widgets_values` via the pinned catalog,
  `links: null` preserved, passthrough keys verbatim.
- `mint(workflow, catalog)` — import an existing workflow JSON into a fresh
  doc (lazy-mint at cutover); the mint output is THE bootstrap snapshot every
  replica forks from (schema §9).
- `migrate(doc, fromVersion)` + `SCHEMA_VERSION` — doc-layout versioning;
  validate + no-op at v1, fail-closed on newer docs (schema §10).
- Stamp machinery (`compareStampKeys`, `stampKey`, `writeTarget`) and doc
  layout helpers (`initDoc`, `nodesMap`, `linksMap`, `definitionsMap`,
  `metaMap`, `createNodeMap`) for the v1 schema: `Y.Map 'nodes'` (per-node
  `Y.Map` with a NAME-KEYED `widgets` `Y.Map` — schema §1.2), `Y.Map 'links'`,
  first-class `Y.Map 'definitions'`, `Y.Map 'meta'` (schema_version,
  catalog_version, id high-water marks, `groups`/`extra` passthrough).

**Status: real (V1-031).** The applier/projection/mint/migrate are the
production implementation, ported from the spike-proven semantics
(`docs/spike-report-v1-007.md`) onto the schema's name-keyed widget layout.
`reset_doc` stays rejected (`op_deferred`) per the vocabulary's deferred
status. The full replay corpus is green — see acceptance gates below.

## The op vocabulary is frozen

Six op kinds: `add_node`, `connect`, `set_widget`, `delete_node`, `clear`,
`reset_doc`. The **normative contract** is the op-vocabulary doc in comfy-cli:
[`docs/op-vocabulary-v1.md`](https://github.com/Comfy-Org/comfy-cli/blob/fix/validate-lowers-ui-to-api/docs/op-vocabulary-v1.md)
(branch `fix/validate-lowers-ui-to-api`), whose stamps are minted by
`comfy_cli/workflow_ops.py`. The `Op` types in `src/index.ts` mirror those
stamps field-for-field; any divergence is a bug here, not there.

## Purity is an invariant, not a convention

This package runs in the browser bundle **and** in the server doc host, so it
must stay free of UI frameworks, DOM implementations, and litegraph. Enforced
by `npm run check:purity` (CI-gated), which:

1. walks the full resolved dependency tree (`npm ls --json --all`) and fails
   on `vue`, `react`, `jsdom`, `electron`, anything matching `/litegraph/i`,
   or other DOM-touching libs;
2. imports the built `dist/index.js` in a bare Node subprocess and asserts no
   DOM globals exist before or after import.

`yjs` is the **only** runtime dependency. Keep it that way.

## Governance

- **The doc schema requires FE sign-off.** Any change to the Y.Doc layout or
  `SCHEMA_VERSION` bump must be reviewed by the frontend team before merge —
  the browser is a co-equal host of this document.
- **Ownership transfers to FE post-V1.** The backend team scaffolds and drives
  this package through V1 cutover; after that it is FE-owned.

## Acceptance gates (V1)

1. **Purity** — `check:purity` green in CI (dependency tree + bare-Node
   import). **Status: green.**
2. **Fixtures green** — recorded op sessions in `fixtures/*.session.jsonl`
   replay through `applyOps` and `project` deep-equals the recorded final
   workflow (`test/replay.test.ts`; format in `fixtures/README.md`).
   **Status: green (un-gated with V1-031)** — plus the permanent suites:
   idempotency (byte-identical re-apply), two-doc convergence under
   reordering, LWW parity (all 6 vectors, both orders), mint→project
   round-trip, and the schema §11 bounded-writes guard.
3. **Published SHA-pinnable artifact** — the package is consumable pinned to
   an exact commit/version by both the frontend and the server doc host.
   **Status: git-SHA pinnable now** (`npm install github:Comfy-Org/comfy-multi-player#<sha>`
   builds via `prepare`; `npm pack` produces the 0.1.0 tarball). Registry
   publish is deliberately deferred — `private: true` stays until the scope /
   registry-auth decision; consumers pin by git SHA in the interim.

## Develop

```bash
npm install
npm run build         # tsc → dist/
npm test              # vitest: schema, purity, replay, lww, convergence, roundtrip, applier
npm run check:purity  # dependency-tree + bare-Node import gate
```
