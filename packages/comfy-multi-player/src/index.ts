/**
 * @comfyorg/comfy-multi-player — shared workflow-document package.
 *
 * One implementation of op→doc semantics, used identically by the browser
 * and the server doc host. The op vocabulary is frozen at six kinds; the
 * normative contract is comfy-cli's `docs/op-vocabulary-v1.md` and the stamp
 * shapes minted by `comfy_cli/workflow_ops.py` (`_new_op`), both pinned at
 * comfy-cli commit `7e732242d971daf0d2d30f22f997abfacd78986e` — by SHA and
 * never by branch, because a branch re-targets silently and a contract that
 * moves under a citation is the FC-10 failure. Section numbers quoted in this
 * package are section numbers AT THAT COMMIT. The pin registry, how the SHA was
 * established, and the amendments upstream has since added are in
 * docs/upstream-pins.json (`npm run check:pins`). The Y.Doc layout and
 * op-semantics reference is docs/multiplayer-schema.md.
 *
 * Public surface:
 *  - `mint(workflow, catalog)` — workflow JSON → fresh Y.Doc (the bootstrap
 *    snapshot every replica forks from — schema §9);
 *  - `applyOps(doc, ops, catalog?)` — idempotent, LWW-gated, abort-remainder
 *    op application (schema §2–§4);
 *  - `inspectOps(ops)` — pure validation and canonical bytes/digest/stamp
 *    extraction for storage preflight (ADR-022);
 *  - `project(doc, catalog)` — canonical workflow JSON projection (schema §7),
 *    fail-closed on a schema this package cannot read (KA-11);
 *  - `migrate(doc, fromVersion)` — layout versioning, fail-closed (schema §10);
 *  - `readSchemaVersion(doc)` / `assertReadableSchema(doc, context)` — the
 *    KA-11 read gate, for a host that wants to refuse a mismatched document
 *    with its own structured error before it reads;
 *  - `encodingLosses(value)` — a read-only diagnostic for values that Yjs
 *    accepts but does not preserve across encode → decode;
 *  - stamp machinery (`compareStampKeys`, `stampKey`, `writeTarget`) for
 *    hosts that need conflict identity or watermark bookkeeping;
 *  - the ADR-004 follower read surface (`nodesMap`, `linksMap`,
 *    `OPAQUE_WIDGETS_KEY`) for consuming the wire layout without applying ops;
 *  - the safer snapshot surface (`readGraph`, `readMeta`, `docCatalogPin`,
 *    `hasNode`, `hasAppliedOp`, `appliedOpIds`, `readStamps`) for consumers
 *    that do not need ADR-004's live follower handles — see src/read.ts;
 *  - operation, workflow, catalog, and result types.
 *
 * Every other Y.Doc layout and low-level mutation helper is deliberately
 * module-private. Consumers that own mutation must change shared state through
 * `applyOps` so stamp, idempotency, and convergence semantics cannot be bypassed.
 *
 * This module is PURE: no DOM, no framework, no litegraph. `yjs` is the only
 * runtime dependency. CI enforces this (scripts/check-purity.mjs).
 */

export * from "./types.js";
export * from "./event-schema.js";
export * from "./stamps.js";
export * from "./limits.js";
export * from "./clock.js";
export {
  CMP_EVENT_SCHEMA_VERSION,
  type CmpCallContext,
  type CmpEvent,
  type CmpEventSink,
  type CmpEventType,
} from "./events.js";
/**
 * ADR-004 follower read-surface. These helpers expose the established wire
 * layout only so the frontend follower can consume host updates. They are
 * read-only by contract: followers never write and never call `applyOps`
 * (KA-1, KA-6, FC-5); the host remains the sole op applier.
 */
export {
  OPAQUE_WIDGETS_KEY,
  encodingLosses,
  linksMap,
  nodesMap,
  type EncodingLoss,
} from "./doc.js";
export { applyOps, inspectOps } from "./applier.js";
export { project } from "./project.js";
export { mint } from "./mint.js";
export { migrate } from "./migrate.js";
export { assertReadableSchema, readSchemaVersion } from "./schema-version.js";
export {
  appliedOpIds,
  docCatalogPin,
  hasAppliedOp,
  hasNode,
  readGraph,
  readMeta,
  readStamps,
  type GraphSnapshot,
  type NodeSnapshot,
} from "./read.js";
