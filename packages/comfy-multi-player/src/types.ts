/**
 * Types and constants for @comfyorg/comfy-multi-player.
 *
 * The op vocabulary is frozen at six kinds; the normative contract is
 * comfy-cli's `docs/op-vocabulary-v1.md` and the stamp shapes minted by
 * `comfy_cli/workflow_ops.py` (`_new_op`), pinned by SHA at comfy-cli
 * `7e732242d971daf0d2d30f22f997abfacd78986e` (FC-10: never by branch — the
 * branch this file used to cite has since been deleted upstream). Every `§`
 * below is a section of that revision; see docs/upstream-pins.json for the pin
 * registry and the amendments upstream has added since.
 * The doc layout + op semantics reference is docs/multiplayer-schema.md.
 */

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

/**
 * Version of the Y.Doc layout. Bump requires FE sign-off + a `migrate` path.
 * The authoritative layout + op-semantics reference is docs/multiplayer-schema.md.
 */
export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Machine-readable op-kind projection (mirrors comfy_cli.workflow_ops
// FROZEN_OPS / DEFERRED_OPS / BATCHABLE_OPS — op-vocabulary-v1.md §1)
// ---------------------------------------------------------------------------

/** The five implemented op kinds. `apply` rejects anything else loudly. */
export const FROZEN_OPS = ["add_node", "connect", "set_widget", "delete_node", "clear"] as const;

/** Defined by the vocabulary but deferred (§1.6): rejected until un-deferred by amendment. */
export const DEFERRED_OPS = ["reset_doc"] as const;

/**
 * Kinds accepted inside a multi-op batch by comfy-cli's `apply_specs` — the
 * **spec-authoring** surface (`comfy workflow apply` / `foreach`), which takes
 * edit *specs* and MINTS ops. `clear` and `reset_doc` rewrite the whole
 * document, so a spec batch containing either is rejected whole, before
 * anything is minted, with its own code (`workflow_clear_not_batchable` /
 * `workflow_reset_doc_not_batchable`) — vocabulary §1, §1.5, §1.6.
 *
 * **This list is deliberately NOT a gate on `applyOps`.** `applyOps` ports
 * `apply_op` — the *replay* surface — whose batch protocol is vocabulary §4
 * abort-remainder with no kind restriction; `apply_op` replays `clear` in any
 * position. Gating dispatch on this list would diverge from `apply_op` (KA-3
 * one-implementation parity) and would reject `fixtures/golden-vectors/
 * conformance.json`'s `edit-heavy` case, which carries a `clear` at index 36
 * of a 61-op stream that `docs/portability.md` requires every conforming
 * runner to apply "in file order with no failures or skips".
 *
 * Exported for a HOST that fronts the applier with its own submission surface:
 * that admission layer is the `apply_specs` analogue and is where the rule
 * belongs. `test/batch-policy.test.ts` pins the list, the README table, and
 * the deliberate non-enforcement together.
 */
export const BATCHABLE_OPS = ["add_node", "connect", "set_widget", "delete_node"] as const;

/** Every kind the {@link Op} union defines — the single source of truth for op kinds. */
export type OpKind = Op["op"];

/** A kind `applyOps` implements. */
export type FrozenOpKind = (typeof FROZEN_OPS)[number];

/** A kind the vocabulary defines but this package rejects (§1.6). */
export type DeferredOpKind = (typeof DEFERRED_OPS)[number];

/** A kind legal inside a multi-op batch. */
export type BatchableOpKind = (typeof BATCHABLE_OPS)[number];

// ---------------------------------------------------------------------------
// Identity & stamps (mirrors comfy_cli/workflow_ops.py `_new_op`)
// ---------------------------------------------------------------------------

/** Who minted an op — a frozen origin string (vocabulary §7): `agent:<thread>:<turn>`, `human:<user>:<tab>`, `system:mint`, legacy `cli`. MUST be ASCII (§8.1). */
export type Actor = string;

/**
 * Node / link identity. comfy-cli mints ints (`mint_id()`, `[2^40, 2^53)`),
 * but historical workflows carry string ids and subgraph-scoped addresses are
 * strings of the form `"57:3"`. Treat as opaque; compare with String()
 * normalization.
 */
export type NodeId = string | number;

/**
 * Causal stamp for last-writer-wins: `[base_version, actor]`, exact ties
 * broken by `op_id` into a total order. Matches the `stamp` field minted by
 * `_new_op` in comfy-cli.
 */
export type Stamp = [baseVersion: number, actor: Actor];

/**
 * The fully-tiebroken LWW comparison key: `[base_version, actor, op_id]`
 * (vocabulary §3 / §8.1). Compared element-wise — numeric, then code-point
 * string order.
 */
export type StampKey = [baseVersion: number, actor: Actor, opId: string];

/** Envelope every op carries (comfy-cli `_new_op`). */
export interface OpBase {
  /** Unique op identity: uuid4 hex, 32 lowercase `[0-9a-f]` chars (vocabulary §8.2 — LWW-load-bearing, never regenerated). */
  op_id: string;
  actor: Actor;
  /** Doc version the op was minted against. */
  base_version: number;
  /** `[base_version, actor]` — see {@link Stamp}. */
  stamp: Stamp;
}

// ---------------------------------------------------------------------------
// The six frozen op kinds
// ---------------------------------------------------------------------------

export interface AddNodeOp extends OpBase {
  op: "add_node";
  node_id: NodeId;
  class_type: string;
  /** Layout decided at mint time so replay stays convergent. */
  pos: number[];
  /** Full mint-time node snapshot — AUTHORITATIVE, inserted verbatim (vocabulary §8.5). */
  node: WorkflowNode;
}

/** Autogrow slot descriptor carried by a `connect` (vocabulary §1.2 / §8.4). */
export interface GrowSpec {
  /** Requested slot name (`images.image0` autogrow shape, or bare `image_2` for the inputcount family). */
  name: string;
  type: string;
  /** Converted-widget name (ComfyUI widget→input conversion), when applicable. */
  widget?: string;
  /** inputcount-family two-register grow (§8.4): also LWW-write this widget to the mint-time-planned value. */
  inputcount?: { widget: string; value: unknown };
  [key: string]: unknown;
}

export interface ConnectOp extends OpBase {
  op: "connect";
  /** Link identity, minted at op-mint time (int in comfy-cli). */
  link_id: NodeId;
  from_node: NodeId;
  from_slot: number;
  to_node: NodeId;
  /** Concrete input index, or null when the slot is grown at apply time (autogrow). */
  to_slot: number | null;
  link_type: string;
  /** Autogrow payload: apply appends this input slot, then wires it. Non-clobbering. */
  grow?: GrowSpec;
}

export interface SetWidgetOp extends OpBase {
  op: "set_widget";
  node_id: NodeId;
  /** Widget NAME — widgets are name-addressed, never index-addressed. */
  widget: string;
  value: unknown;
  /** Previous value at mint time (informational; not used for convergence). */
  old?: unknown;
  /** Subgraph interior addressing: RESOLVED node path segments (e.g. ["57","27"]) — all three address forms normalize here (vocabulary §8.7). */
  path?: string[] | null;
  /** Interior widget name when `path` is present. */
  inner_widget?: string | null;
  /** Non-fatal validation notes attached at mint time. */
  warnings?: unknown[];
}

export interface DeleteNodeOp extends OpBase {
  op: "delete_node";
  node_id: NodeId;
  /** Link ids severed by this delete (recorded at mint time). */
  removed_links: NodeId[];
}

export interface ClearOp extends OpBase {
  op: "clear";
  /** Node ids present at mint time. Id counters are preserved across a clear. */
  removed_nodes: NodeId[];
}

/**
 * Replace the entire document with a workflow snapshot.
 *
 * DEFERRED (vocabulary §1.6): comfy-cli's `apply_op` rejects `reset_doc` and
 * the contract tests pin that it stays rejected until un-deferred by
 * amendment. `applyOps` here rejects it with code `op_deferred`. The payload
 * below is this package's draft shape for when it lands.
 */
export interface ResetDocOp extends OpBase {
  op: "reset_doc";
  workflow: WorkflowJSON;
}

/** The six frozen op kinds — a discriminated union on `op`. */
export type Op =
  | AddNodeOp
  | ConnectOp
  | SetWidgetOp
  | DeleteNodeOp
  | ClearOp
  | ResetDocOp;

// ---------------------------------------------------------------------------
// Op-kind partition guard (issue #21)
//
// `FROZEN_OPS` / `DEFERRED_OPS` / `BATCHABLE_OPS` are hand-written arrays and
// `Op` is a hand-written union; nothing structurally tied them together, so a
// seventh op kind could be added to `Op` (or to one array) and every other
// site would keep compiling while silently disagreeing about the vocabulary.
// The assertions below make that a `tsc` failure at THIS line:
//
//   - FROZEN ∪ DEFERRED must be exactly `Op["op"]` — every declared kind is
//     either implemented or explicitly deferred, and neither list may name a
//     kind the union does not declare;
//   - BATCHABLE must be a subset of FROZEN — a batchable kind that `applyOps`
//     does not implement is a contradiction.
//
// `[A] extends [B]` (tuple-wrapped) is deliberate: it suppresses union
// distribution, so `Equals` compares the unions as wholes rather than
// member-by-member, which would make the check vacuously true.
// ---------------------------------------------------------------------------

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

/** Every `Op` member is exactly once in FROZEN_OPS or DEFERRED_OPS. */
type _OpKindsArePartitioned = Assert<Equals<FrozenOpKind | DeferredOpKind, OpKind>>;
/** No kind is both implemented and deferred. */
type _FrozenAndDeferredAreDisjoint = Assert<Equals<FrozenOpKind & DeferredOpKind, never>>;
/** Batchable kinds are a subset of the implemented kinds. */
type _BatchableIsSubsetOfFrozen = Assert<Equals<Exclude<BatchableOpKind, FrozenOpKind>, never>>;

// ---------------------------------------------------------------------------
// Widget catalog (pinned object_info projection)
//
// The op model is deliberately name-addressed and therefore NOT self-contained:
// projecting the name-keyed `widgets` map back to the positional
// `widgets_values` array requires the widget order of the object_info catalog
// the document pins (`meta.catalog_version`). At apply time the catalog is
// needed to decompose an `add_node` payload's positional `widgets_values`
// into the name-keyed map, for autogrow collision renames
// (`autogrow_templates`), and to reject unknown widget names.
// See docs/multiplayer-schema.md §1.2 / §7; fixtures/catalog.json is the shape.
// ---------------------------------------------------------------------------

/** Per-class widget metadata from the pinned object_info catalog. */
export interface WidgetCatalogEntry {
  /** Widget names in positional (widgets_values) order. */
  widget_order: string[];
  /** Autogrow element-naming templates, keyed by the growable input's base name. */
  autogrow_templates?: Record<string, { prefix?: string; names?: string[] }>;
}

/** The pinned catalog: class_type → entry. Matches fixtures/catalog.json. */
export interface WidgetCatalog {
  comment?: string;
  types: Record<string, WidgetCatalogEntry>;
}

// ---------------------------------------------------------------------------
// Workflow JSON (loose — the projection target, litegraph-shaped)
// ---------------------------------------------------------------------------

export interface WorkflowNode {
  id: NodeId;
  type: string;
  pos?: number[];
  size?: number[];
  flags?: Record<string, unknown>;
  order?: number;
  mode?: number;
  inputs?: unknown[];
  outputs?: unknown[];
  widgets_values?: unknown[] | Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * ComfyUI workflow JSON, typed loosely on purpose: this package guarantees
 * the fields it projects and passes everything else through untouched.
 */
export interface WorkflowJSON {
  nodes: WorkflowNode[];
  links: unknown[];
  groups?: unknown[];
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Apply result
// ---------------------------------------------------------------------------

/** The abort-remainder failure record (vocabulary §4): ops after `index` were not applied. */
export interface ApplyFailure {
  /** Index (into the `ops` argument) of the op that failed. */
  index: number;
  /** The failing op, verbatim. */
  op: Op;
  /** Stable machine-readable rejection code (e.g. `unknown_op`, `op_deferred`, `unknown_widget`). */
  code: string;
  /** Human-readable explanation. */
  message: string;
}

/**
 * Outcome of `applyOps` — per-op accounting, never a throw for a rejected op.
 *
 * `applied` counts every op that consumed its `op_id` in this call — including
 * LWW-dropped writes and delete-wins no-ops, which are protocol-level applies
 * (comfy-cli records their op_id too). `skipped` is idempotency only: op_ids
 * already applied before this call. On failure, `failed` is set, ops after
 * `failed.index` are NOT applied (abort-remainder), and the applied prefix is
 * retained — a retried batch converges via the op_id gate.
 */
export interface ApplyResult {
  /** op_ids consumed by this call, in apply order. */
  applied: string[];
  /** op_ids skipped as already-applied duplicates (idempotence). */
  skipped: string[];
  /** Abort-remainder failure, or null when every op was consumed or skipped. */
  failed: ApplyFailure | null;
  /** `applied.length` — the vocabulary §4 ack field. */
  applied_count: number;
  /** Doc revision after apply: total ops ever consumed by this doc (`__applied` size). */
  version: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * A rejected op (unknown/deferred kind, malformed payload, unknown widget,
 * missing slot, …). `applyOps` converts this into `ApplyResult.failed` —
 * rejection is loud but never a throw at the batch surface.
 */
export class OpRejectedError extends Error {
  override name = "OpRejectedError";
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** A doc whose schema_version this package cannot read or migrate (schema §10 — fail-closed). */
export class SchemaVersionError extends Error {
  override name = "SchemaVersionError";
}
