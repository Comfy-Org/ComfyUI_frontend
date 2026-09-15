# API-contract review

Catch breaking changes to this package's public surface. Applies to `src/index.ts`, exported types, the op vocabulary, the wire envelope, and `schema_version`/`catalog_version` handling.

## What to check

1. **Public exports** — `src/index.ts` re-exports the op layer, KA-11 read gate, ADR-004 follower reads, #71's payload-bound constants and `opBoundsRefusal` from `src/limits.ts`, the snapshot surface from `src/read.ts`, and everything from `types` and `stamps`. A removed or renamed export without a compatibility alias is breaking. New exports are fine only when deliberately classified.
   Most of `src/doc.ts` stays private because its accessors and mutators bypass the op layer (KA-1, KA-2, KA-4, FC-5). Re-adding `export * from "./doc.js"`, or adding a `./doc` subpath, or exposing any further `doc.ts` runtime export from the entrypoint, is a blocking finding, not a compatibility fix. The named exceptions are `nodesMap`, `linksMap`, and `OPAQUE_WIDGETS_KEY` (ADR-004's frontend-follower reads) plus `encodingLosses` (KA-1's read-only value diagnostic, which takes no document); `test/public-api.regression.test.ts` guards that exact list, and widening it is a diff rather than a silent consequence of adding an export.
   Prefer snapshot reads for new consumers: values returned by `src/read.ts` must not expose a live `Y.AbstractType`, at any depth. `test/readonly-surface.test.ts` proves its current functions return deep-copied, deep-frozen plain data, and that they refuse a document carrying content under an unreadable schema on the same predicate `project()` uses (KA-11). Not the same DISPOSITION, and do not report it as such: for a document carrying NOTHING the snapshot surface returns its empty value where `project()` refuses — Amendment A12 records that divergence against A5's consumer-impact note. Two things are blocking findings here: a gate on this surface that asks "does the document carry content" by enumerating the §1 root NAMES (blind to a v2 that renamed them, which is the canonical bump trigger), and a new entrypoint export not classified by that test.

<!-- claim: "encodingLosses", :: test/public-api.regression.test.ts -->
<!-- claim: read-only surface — the KA-11 read gate (#38) :: test/readonly-surface.test.ts -->
<!-- claim: export * from "./limits.js"; :: src/index.ts -->
2. **Op vocabulary** — op kind names, required fields, and the frozen/deferred sets are a contract shared with the server. Renaming an op kind, adding a required field to an existing op, or moving an op between frozen and deferred is breaking; cite the vocabulary section.
3. **Wire envelope** — the `{ type, data }` shape and `data.v` protocol version are cross-repo. Changing an existing message type, its payload shape, or bumping `data.v` without a documented migration is breaking.
4. **Stamp/order contract** — the total order key `[base_version, actor, op_id]` and `ApplyResult` shape (`applied`, `skipped`, `failed`, `version`) are consumed downstream; narrowing or reshaping them is breaking. **That field list is incomplete and known to be wrong — see "Known defects" below ([#73](https://github.com/Comfy-Org/comfy-multi-player/issues/73)); do not rely on it as an enumeration.**
   In private alpha, `base_version` is the creator-owned Lamport counter carried in the single op format; there is no schema-v3 or dual-reader surface. DQ-11 incarnation-qualified target keys must remain unchanged.
5. **Schema/catalog versioning** — bump `SCHEMA_VERSION` when an old reader would mis-project a new doc, and keep a `migrate()` path (KA-11). Silently changing on-doc shape without a version bump is a breaking, fail-open change.
6. **Type narrowing / default changes** — an exported function that used to accept a wider input now rejecting part of it, or a changed default, can break callers.

## Rules

- Only flag changes that break existing consumers; do not flag additions.
- Check for a re-export alias or `migrate()` path before flagging.
- Do not treat `__`-prefixed internal doc keys as public API.
- Critical for removed/renamed exports or op kinds; high for changed signatures or wire shapes; medium for changed defaults. Cite the affected KA-*/FC-* ID where relevant.

<!--
Staleness anchors for rule 1 (the public export surface this profile restates).
`scripts/check-profile-claims.mjs` verifies each substring below is still present
verbatim in the cited file; if an export is removed or renamed, this profile fails
CI so the prose above cannot silently describe a contract that no longer exists.
-->
<!-- claim: export { applyOps } from "./applier.js" :: src/index.ts -->
<!-- claim: export { project } from "./project.js" :: src/index.ts -->
<!-- claim: export * from "./clock.js" :: src/index.ts -->
<!-- claim: export { mint } from "./mint.js" :: src/index.ts -->
<!-- claim: export { migrate } from "./migrate.js" :: src/index.ts -->
<!-- claim: export { assertReadableSchema, readSchemaVersion } from "./schema-version.js" :: src/index.ts -->
<!-- claim: export * from "./types.js" :: src/index.ts -->
<!-- claim: export * from "./stamps.js" :: src/index.ts -->

## Known defects, left standing on purpose

One finding about this profile and the contract it describes is **diagnosed, filed and not fixed
here**. They are recorded as `known-defect` tombstones rather than as a line in a report, because a
report is not something the repository can see: the `test-quality.md` rejection oracle was diagnosed
independently by two merge reviews (#34, #58) and relayed into a third (#60), each of which correctly
scoped it out, and every one of those findings was written outside this repo. Zero reviews and zero
inline comments exist on those PRs. The defect outlived all three for want of one line. See
[`README.md`](README.md#tombstones-for-a-defect-you-are-not-fixing). A tombstone never blocks the
fix: it makes the fix a two-line change — correct the text, delete the marker — and reddens CI if the
second line is forgotten.

- **Rule 4 lists four `ApplyResult` fields and the interface has five** — `applied_count` is missing,
  and its own doc-comment calls it the vocabulary §4 ack field, so a reviewer applying this profile
  would not flag its removal as breaking. Filed as [#73](https://github.com/Comfy-Org/comfy-multi-player/issues/73),
  together with the unanchored rules 2/3/5 that are the reason nothing caught it. The correction
  itself is one word, and that is why it is not made here: rule 4 carries no claim marker, so a
  one-word fix leaves the corrected sentence exactly as free to drift back as the wrong one was, and
  #73's subject is the missing anchors for rules 2-5 rather than this one instance. Rule 4 above now
  warns the reader in place, so nobody is misled while the tombstone stands.
<!-- known-defect: #73 :: (`applied`, `skipped`, `failed`, `version`) :: .agents/checks/api-contract.md -->

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
