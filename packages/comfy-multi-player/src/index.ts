/**
 * @comfyorg/comfy-multi-player — shared workflow-document package.
 *
 * One implementation of op→doc semantics, used identically by the browser
 * and the server doc host. The op vocabulary is frozen at six kinds; the
 * normative contract is comfy-cli's `docs/op-vocabulary-v1.md` (branch
 * `fix/validate-lowers-ui-to-api`) and the stamp shapes minted by
 * `comfy_cli/workflow_ops.py` (`_new_op`). The Y.Doc layout and op-semantics
 * reference is docs/multiplayer-schema.md.
 *
 * Public surface:
 *  - `mint(workflow, catalog)` — workflow JSON → fresh Y.Doc (the bootstrap
 *    snapshot every replica forks from — schema §9);
 *  - `applyOps(doc, ops, catalog?)` — idempotent, LWW-gated, abort-remainder
 *    op application (schema §2–§4);
 *  - `project(doc, catalog)` — canonical workflow JSON projection (schema §7);
 *  - `migrate(doc, fromVersion)` — layout versioning, fail-closed (schema §10);
 *  - stamp machinery (`compareStampKeys`, `stampKey`, `writeTarget`) for
 *    hosts that need conflict identity or watermark bookkeeping;
 *  - layout helpers (`initDoc`, `nodesMap`, …) and the types.
 *
 * This module is PURE: no DOM, no framework, no litegraph. `yjs` is the only
 * runtime dependency. CI enforces this (scripts/check-purity.mjs).
 */

export * from "./types.js";
export * from "./stamps.js";
export * from "./doc.js";
export { applyOps } from "./applier.js";
export { project } from "./project.js";
export { mint } from "./mint.js";
export { migrate } from "./migrate.js";
