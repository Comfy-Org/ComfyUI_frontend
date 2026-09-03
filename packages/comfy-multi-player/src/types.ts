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
export const SCHEMA_VERSION = 2;

/** Internal per-node lifetime key. It never projects into workflow JSON. */
export const NODE_INCARNATION_KEY = "__incarnation";

/** Incarnation assigned to nodes imported from a pre-incarnation workflow. */
export const LEGACY_NODE_INCARNATION = "0";

// ---------------------------------------------------------------------------
// Machine-readable op-kind projection (mirrors comfy_cli.workflow_ops
// FROZEN_OPS / DEFERRED_OPS / BATCHABLE_OPS — op-vocabulary-v1.md §1)
// ---------------------------------------------------------------------------

/** The implemented op kinds. `apply` rejects anything else loudly. */
export const FROZEN_OPS = ["add_node", "connect", "disconnect", "set_widget", "delete_node", "clear"] as const;

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
export const BATCHABLE_OPS = ["add_node", "connect", "disconnect", "set_widget", "delete_node"] as const;

/** A kind `applyOps` implements. */
export type FrozenOpKind = (typeof FROZEN_OPS)[number];

/** A kind the vocabulary defines but this package rejects (§1.6). */
export type DeferredOpKind = (typeof DEFERRED_OPS)[number];

/**
 * A kind comfy-cli's `apply_specs` **authoring** surface accepts in a spec
 * batch (§1). NOT a statement about `applyOps`, which is the replay surface
 * and imposes no kind restriction — see {@link BATCHABLE_OPS} above, and
 * `test/batch-policy.test.ts`, which pins that `applyOps` applies a
 * non-batchable `clear` inside a multi-op batch.
 */
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
 *
 * AUTHORITATIVE, and deliberately not merely a copy of the envelope. `_new_op`
 * happens to mint it equal to `[base_version, actor]`, but the ordering key is
 * read out of THIS field whenever the op carries one (see `stampKey`); the
 * envelope reading is a fallback for a missing or malformed stamp, never a
 * re-derivation over one that is present. That is what lets any replica
 * evaluate order offline (KA-2) instead of deferring to a server-assigned
 * scalar (FC-2). A minter may set it to something the envelope does not imply;
 * `test/ka2-stamp-inside-op.test.ts` pins that it is honoured when it does.
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
// The seven declared op kinds: six implemented (`Op`) plus the deferred
// `reset_doc` (`DeferredOp`); together `WireOp`. "Frozen" now means
// implemented — `FROZEN_OPS` is pinned to `Op["op"]` exactly (issue #17).
// ---------------------------------------------------------------------------

export interface AddNodeOp extends OpBase {
  op: "add_node";
  /** Creator-carried lifetime token; omitted by legacy v1 op streams (life 0). */
  node_incarnation?: string;
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
  /**
   * The destination is a subgraph instance and `name` is one of its
   * definition's DECLARED inputs (schema Amendment A15; comfy-cli
   * `_resolve_promoted_target`, PR #815 at
   * `ba0b0b92abcc86b01e8a6704d07088f92afe7aa7`). The input is ONE register
   * named by the definition: an `inputs[]` entry with that `name` is reused if
   * the instance already carries one, otherwise `{name, type, link, grow_id,
   * widget?}` is appended VERBATIM — never a numbered collision rename, never a
   * family template. `widget` is present exactly when the declared input backs
   * an interior widget; absent for a socket-only input. Unlike an autogrow,
   * the register IS stamp-gated — `("input", to_node, "grow", name)` with the
   * FULL declared name, since names may contain dots (comfy-cli amendment
   * v1.5, PR #818 at `ba0b0b92abcc86b01e8a6704d07088f92afe7aa7`) — because
   * two connects into one declared input contend for one slot the way two
   * concrete connects do.
   */
  promoted?: boolean;
  [key: string]: unknown;
}

/**
 * A `set_widget` addressed at a promoted subgraph widget's HOST value
 * (schema Amendment A15; ComfyUI_frontend ADR 0009; comfy-cli PR #815 at
 * `ba0b0b92abcc86b01e8a6704d07088f92afe7aa7`).
 *
 * The frontend keeps a promoted widget's value on the INSTANCE node, as
 * `widgets_values[value_index]` positional over the definition's widget-backed
 * inputs, and runs it over the interior default. A subgraph instance's `type`
 * is a definition UUID and is never in the widget catalog, so this applier
 * stores its `widgets_values` opaquely (Amendment A2) — a named write cannot
 * be expressed against it, and a POSITIONAL one is what this payload carries.
 */
export interface PromotedHostWrite {
  /** Position in the instance's positional `widgets_values`; a non-negative integer. */
  value_index: number;
  /**
   * The RESOLVED path to the host instance, one segment per nesting level:
   * `["57"]` for a top-level instance; `["57", "61"]` when the host is itself
   * interior to another definition (comfy-cli then mints `node_id` as the
   * joined path, `"57/61"`). Resolved exactly like an interior `path`
   * (`resolveInteriorNode`), including the schema §5.3 shared-definition rule.
   * Defaults to `[String(node_id)]` when absent, and when present MUST join
   * (with `/`) to `String(node_id)` — the register is named by `node_id`, so a
   * disagreement is `malformed_op`, never two registers for one node.
   */
  instance_path?: Array<string | number>;
  /**
   * The FULL host array after the write, as comfy-cli materialized it (missing
   * entries seeded from the interior defaults so the array stays aligned with
   * the definition's inputs). Used only to EXTEND a stored array that is
   * shorter than `value_index + 1`; entries the document already holds win.
   * Must cover `value_index`.
   */
  host_widgets_values: unknown[];
}

/** Fields every `connect` carries, whichever way its destination slot is addressed. */
interface ConnectOpBase extends OpBase {
  op: "connect";
  /** Non-empty subgraph-instance path for an interior connect. */
  path?: [NodeId, ...NodeId[]];
  /** Link identity, minted at op-mint time (int in comfy-cli). */
  link_id: NodeId;
  from_node: NodeId;
  from_slot: number;
  to_node: NodeId;
  link_type: string;
  /** Lifetime of `to_node` for the optional inputcount widget write. */
  node_incarnation?: string;
}

/**
 * A `connect` into an input slot that ALREADY EXISTS on the destination:
 * `to_slot` is the concrete index and there is no `grow` payload.
 *
 * This is the variant that claims the `("input", to_node, to_slot)` LWW
 * register (schema §3 / amendment A1).
 */
export interface ConcreteConnectOp extends ConnectOpBase {
  /** Concrete input index. */
  to_slot: number;
  /**
   * Absent, or explicitly `null` — the mirror of {@link TopLevelSetWidgetOp}'s
   * `path`/`inner_widget`, for a peer that emits every field. `null` is what
   * the applier's discriminant (`op.grow != null`) treats as "no grow", so the
   * type admits exactly what the runtime treats as concrete.
   *
   * Issue #17: a grow PAYLOAD and a numeric `to_slot` are mutually exclusive
   * by construction — the applier grows and wires its OWN slot whenever `grow`
   * is set and never reads `to_slot`, so an op carrying both names a
   * destination it does not use.
   */
  grow?: null;
}

/**
 * A `connect` whose destination slot is GROWN at apply time (autogrow —
 * vocabulary §1.2 / §8.4). The index is decided by the applier from
 * `grow_id`, so there is no concrete `to_slot` to name.
 *
 * The GROWN SLOT is deliberately not gated on a shared register: every grow
 * mints its own slot keyed by `grow_id`, so two concurrent grows onto one base
 * both survive and there is nothing to contest.
 *
 * That is a statement about the slot, NOT about the op. A grow carrying
 * `grow.inputcount` also performs a stamped widget write sharing this op's
 * `op_id` and stamp, on the ordinary `("widget", to_node, inputcount)`
 * register (schema §3 / §8.3, vocabulary §8.4) — see `applyInputcountBump`.
 * One op, two registers.
 */
export interface GrowConnectOp extends ConnectOpBase {
  /**
   * Absent, or explicitly `null` as comfy-cli mints it. Issue #17: a number
   * here would name a slot the applier does not wire.
   */
  to_slot?: null;
  /** Autogrow payload: apply appends this input slot, then wires it. Non-clobbering. */
  grow: GrowSpec;
}

/**
 * A `connect` op — a union discriminated by the presence of `grow`
 * (issue #17). `op.grow != null` narrows to {@link GrowConnectOp}; the `else`
 * branch is a {@link ConcreteConnectOp} whose `to_slot` is a number.
 */
export type ConnectOp = ConcreteConnectOp | GrowConnectOp;

export interface DisconnectOp extends OpBase {
  op: "disconnect";
  /** Link identity being severed. */
  link_id: NodeId;
  /** Concrete destination input register this disconnect claims. */
  to_node: NodeId;
  to_slot: number;
}

/** Fields every `set_widget` carries, whichever node the write is addressed to. */
interface SetWidgetOpBase extends OpBase {
  op: "set_widget";
  node_id: NodeId;
  /**
   * Widget NAME — widgets are name-addressed, never index-addressed.
   *
   * On an INTERIOR write the applier does not read this field at all: the
   * write and its LWW target both come from `path` + `inner_widget`. Every
   * interior op in the corpus carries `widget === inner_widget` (promotion
   * through `proxyWidgets` keeps the interior widget's own name), so the two
   * agreeing is the norm and a disagreement is not detected — the same "dead
   * weight on the interior path" hazard `node_id` has, recorded in
   * `test/invalid-op-states.test.ts`.
   */
  widget: string;
  value: unknown;
  /** Creator-carried lifetime of the addressed node; absent means legacy life 0. */
  node_incarnation?: string;
  /** Previous value at mint time (informational; not used for convergence). */
  old?: unknown;
  /** Non-fatal validation notes attached at mint time. */
  warnings?: unknown[];
  /**
   * The address the writer GAVE when comfy-cli redirected the write elsewhere
   * (`"57/13.width"` for an interior address that backs a promotion, rewritten
   * to the host; `"57.width"` for a promoted input fed by a primitive,
   * rewritten to that primitive). Informational only: the applier never reads
   * it, and the register is decided by the fields the op actually carries.
   */
  redirected_from?: string;
}

/**
 * A `set_widget` addressed at a TOP-LEVEL node: `node_id` + `widget`, with no
 * interior path.
 *
 * Issue #17: `path` and `inner_widget` are pinned to `null`/absent rather than
 * left as free optionals. An `inner_widget` without a `path` is not an
 * interior write — the applier ignores it and writes `widget` at the top
 * level, i.e. a DIFFERENT widget than the one the op names.
 */
export interface TopLevelSetWidgetOp extends SetWidgetOpBase {
  path?: null;
  inner_widget?: null;
  /**
   * Present on a promoted HOST write (Amendment A15): the value goes to
   * `widgets_values[value_index]` of the instance at `instance_path`, never to
   * a named widget. `node_id` + `widget` still name the LWW register —
   * `("widget", String(node_id), widget)`, the same one a named top-level
   * write on that node would claim (comfy-cli `_write_target`). A host write
   * never carries `path`; one that does is rejected `malformed_op`.
   */
  promoted?: PromotedHostWrite | null;
}

/**
 * A `set_widget` addressed INSIDE a subgraph definition (vocabulary §8.7).
 *
 * `path` is the RESOLVED node path (e.g. `["57","27"]`) — all three address
 * forms normalize here — and `inner_widget` is the widget name inside the
 * definition. Issue #17: the two are required TOGETHER and the path is
 * non-empty by type, because the applier's interior branch is entered on
 * `path.length > 0` and needs `inner_widget` to know what to write. An empty
 * path with an `inner_widget` is silently treated as a top-level write.
 *
 * Since comfy-cli PR #815 an interior address that BACKS a promotion is
 * redirected to the host at mint time and arrives as a
 * {@link TopLevelSetWidgetOp} with `promoted`; what still arrives here is a
 * write to an unpromoted interior widget. The two are DIFFERENT registers —
 * `("widget", ["57","13"], "width")` vs `("widget", "57", "width")` — and are
 * deliberately not unified (Amendment A15).
 */
export interface InteriorSetWidgetOp extends SetWidgetOpBase {
  path: [string, ...string[]];
  inner_widget: string;
  promoted?: null;
}

/**
 * A `set_widget` op — a union discriminated by `path` (issue #17). A truthy,
 * non-empty `path` narrows to {@link InteriorSetWidgetOp}, where
 * `inner_widget` is a `string` rather than a maybe-absent optional.
 */
export type SetWidgetOp = TopLevelSetWidgetOp | InteriorSetWidgetOp;

export interface DeleteNodeOp extends OpBase {
  op: "delete_node";
  node_id: NodeId;
  /** Link ids severed by this delete (recorded at mint time). */
  removed_links: NodeId[];
}

export interface ClearOp extends OpBase {
  op: "clear";
  /**
   * Node ids present at mint time — the AUTHORITATIVE target set (schema §6
   * amendment A7). The applier never re-derives it from its own live `nodes`
   * map, so an empty list removes nothing rather than emptying the graph.
   * Id counters are preserved across a clear.
   */
  removed_nodes: NodeId[];
}

/**
 * Replace the entire document with a workflow snapshot.
 *
 * DEFERRED (vocabulary §1.6): comfy-cli's `apply_op` rejects `reset_doc` and
 * the contract tests pin that it stays rejected until un-deferred by
 * amendment. `applyOps` here rejects it with code `op_deferred`. The payload
 * below is this package's draft shape for when it lands.
 *
 * Issue #17: this is NOT a member of {@link Op}. `Op` is what `applyOps`
 * implements, and a type whose every value is guaranteed to be rejected does
 * not belong in it — it let a caller construct an op, hand it to the applier,
 * type-check, and be refused at runtime every single time. It lives in
 * {@link WireOp} instead: the vocabulary a peer may legally put on the wire,
 * which is what the runtime validator (not the type system) polices. Nothing
 * about the runtime rejection changed; see `applier.validateEnvelope`.
 */
export interface ResetDocOp extends OpBase {
  op: "reset_doc";
  workflow: WorkflowJSON;
}

/**
 * The op kinds `applyOps` IMPLEMENTS — a discriminated union on `op`.
 *
 * Every member is a kind that can actually be applied. Deferred kinds are in
 * {@link DeferredOp}; the full declared vocabulary is {@link WireOp}.
 */
export type Op =
  | AddNodeOp
  | ConnectOp
  | DisconnectOp
  | SetWidgetOp
  | DeleteNodeOp
  | ClearOp;

/**
 * A kind the vocabulary declares but this package refuses to apply
 * (§1.6) — currently only {@link ResetDocOp}.
 */
export type DeferredOp = ResetDocOp;

/**
 * Everything the frozen vocabulary declares, implemented or not: what a
 * conforming peer may put on the wire and therefore what a host may hold
 * before the applier's validator has ruled on it.
 *
 * Use this for values that CROSS the boundary — `ApplyFailure.op` (a
 * rejected `reset_doc` genuinely lands there) and the public stamp helpers,
 * which hosts feed straight off the wire. Use {@link Op} for values you are
 * asking the applier to apply.
 *
 * NOTE, stated so it is not mistaken for a guarantee: a peer built against a
 * NEWER vocabulary can put a kind on the wire that is in neither union. No
 * static type can describe that value; `validateEnvelope` rejecting it with
 * `unknown_op` is what protects the document.
 */
export type WireOp = Op | DeferredOp;

// ---------------------------------------------------------------------------
// Op-kind partition guard (issue #21, strengthened by issue #17)
//
// `FROZEN_OPS` / `DEFERRED_OPS` / `BATCHABLE_OPS` are hand-written arrays and
// `Op` is a hand-written union; nothing structurally tied them together, so a
// seventh op kind could be added to `Op` (or to one array) and every other
// site would keep compiling while silently disagreeing about the vocabulary.
// The assertions below make that a `tsc` failure at THIS line:
//
//   - FROZEN must be exactly `Op["op"]` and DEFERRED exactly
//     `DeferredOp["op"]` — since issue #17 split the implemented union from
//     the deferred one, each list is pinned to its own union rather than the
//     pair being pinned only to their sum. A kind moved between `Op` and
//     `DeferredOp` (un-deferring `reset_doc`, say) must move between the
//     arrays in the same commit;
//   - FROZEN ∪ DEFERRED must be exactly `WireOp["op"]` — neither list may
//     name a kind the vocabulary does not declare;
//   - BATCHABLE must be a subset of FROZEN — a batchable kind that `applyOps`
//     does not implement is a contradiction.
//
// `[A] extends [B]` (tuple-wrapped) is deliberate: it suppresses union
// distribution, so `Equals` compares the unions as wholes rather than
// member-by-member, which would make the check vacuously true.
// ---------------------------------------------------------------------------

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Checked<T, Checks extends readonly true[]> = T &
  (Checks[number] extends true ? unknown : never);

/** Every kind the vocabulary defines — implemented ({@link Op}) plus deferred ({@link DeferredOp}). */
export type OpKind = Checked<
  WireOp["op"],
  [
    Equals<FrozenOpKind, Op["op"]>,
    Equals<DeferredOpKind, DeferredOp["op"]>,
    Equals<FrozenOpKind | DeferredOpKind, WireOp["op"]>,
    Equals<FrozenOpKind & DeferredOpKind, never>,
    Equals<Exclude<BatchableOpKind, FrozenOpKind>, never>,
  ]
>;

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
  /**
   * The failing op, verbatim.
   *
   * Typed {@link WireOp}, not {@link Op}: the ops that reach this field are by
   * definition the ones the applier refused, which includes a deferred
   * `reset_doc`. Typing it `Op` said a value could not appear here that
   * demonstrably does (issue #17).
   *
   * Still not the whole truth, and deliberately not papered over: an op whose
   * kind this build has never heard of is rejected `unknown_op` and lands here
   * too, and it is in no union. Consumers that switch on `failed.op.op` must
   * keep a default arm.
   */
  op: WireOp;
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
export type ApplyOutcome =
  | { op_id: string; outcome: "applied" }
  | { op_id: string; outcome: "no-op" }
  | { op_id: string; outcome: "lww-dropped" }
  | {
      op_id: string;
      outcome: "rejected";
      reason: { code: string; message: string };
    };

export interface ApplyResult {
  /** One ordered, discriminated outcome for every submitted op. */
  outcomes: ApplyOutcome[];
  /** Total op identities consumed by this document (`__applied` size), not a CAS token. */
  ops_seen: number;
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
