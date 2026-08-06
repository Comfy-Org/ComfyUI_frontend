/**
 * The published ComfyUI custom-node API — the complete surface.
 *
 * Generated from src/platform/nodeApi. If a member is not here it does not
 * exist: do not call it, and punt as api-gap naming what is missing.
 * Reached from a converted pack as:
 *
 *   import { comfy } from '/comfy/api/v1.js'
 */

// ─── closedProxy.ts ──────────────────────────────────────────────

/**
 * Closed proxy handles for the public custom-node API.
 *
 * A handle stores an **id**, never a reference. Every access re-resolves the
 * entity, which gives three properties the previous API could not:
 *
 * 1. No internal object is reachable. Property access outside the declared
 *    surface returns `undefined`; there is no prototype, no `constructor`, and
 *    no `__v_raw` escape to the Vue reactive target.
 * 2. Handles outlive their entities safely. A pack that stores a handle and
 *    reads it after the node is deleted gets `isDeleted === true` and inert
 *    reads, not a stale object that still looks alive.
 * 3. Identity is stable. `graph.node(id) === graph.node(id)`, so the equality
 *    checks packs already write keep working.
 */
import { ComfyDeletedError, ComfyReadonlyError } from './errors'

/**
 * Method names that write a value.
 *
 * Removal and disconnection are deliberately absent: they are idempotent, so on
 * a dead handle the caller's desired end state already holds and throwing would
 * break the cleanup paths packs run after removal. Setting a value is not
 * idempotent, and dropping it silently hides a real bug.
 */
const MUTATOR = /^(set|add|move|reorder|connect|modify)/

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface PropSpec<TTarget> {
  get(target: TTarget): unknown
  set?(target: TTarget, value: unknown): void
  /** Appended to the error when a pack assigns to a read-only property. */
  readonlyHint?: string
}

export interface HandleSpec<TTarget> {
  /** Used in errors and `Symbol.toStringTag`, e.g. 'node'. */
  readonly kind: string
  readonly props: Readonly<Record<string, PropSpec<TTarget>>>
  readonly methods?: Readonly<
    Record<string, (target: TTarget, ...args: never[]) => unknown>
  >
  /**
   * Props that remain readable after deletion. Identity only — an id or type is
   * still useful for logging and cleanup once the entity is gone.
   */
  readonly identityProps?: readonly string[]
}

/** Present on every handle. Never throws, even when the entity is gone. */
export interface HandleCommon {
  readonly isDeleted: boolean
}

export interface HandleToken {
  readonly kind: string
  readonly id: string
}

// ─── comfyApi.ts ─────────────────────────────────────────────────

export interface Comfy {
  /**
   * `major.minor`. Prefer `supports()` over comparing this — a capability
   * survives being backported or reordered across minors; a version comparison
   * does not.
   */
  readonly version: string
  /** Breaking-change generation. Incremented only when something is removed. */
  readonly major: number
  /** Cheap, never throws. The supported way to branch. */
  supports(capability: string): boolean
  /** Asserts a capability, with an actionable error naming it. */
  require(capability: string): void
  /** Every capability this host provides. */
  capabilities(): readonly string[]
  /**
   * Pins to a specific major. Every major this host knows stays available, so a
   * pack written against an older one keeps working indefinitely.
   */
  forMajor(major: number): Comfy

// ─── defsRegistry.ts ─────────────────────────────────────────────

/**
 * `defs.extend` — the published replacement for `beforeRegisterNodeDef`.
 *
 * This is the largest surface in the ecosystem: 1,265 packs (47.4% of installs)
 * register that hook, and 1,191 of them use it to patch the generated class's
 * prototype. Two things change here, and both matter:
 *
 * 1. **The selector is declarative.** Today every hook runs for every node type
 *    and nearly all of them immediately `return` after a name check — with
 *    thousands of types that is millions of wasted callbacks at boot. A
 *    predicate we own can be matched against a def instead.
 * 2. **Callbacks compose.** Prototype patching has no composition, so packs
 *    capture-and-chain (`orig?.apply(this, arguments)`) and whether that works
 *    depends on load order and on every pack remembering to call through. Two
 *    packs patching the same method, one forgetting, silently breaks the other.
 *    Registered callbacks are invoked in registration order, always.
 */
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

import { ComfyApiError } from './errors'
import type { NodeHandle } from './nodeHandle'
import type { Resolver } from './resolution'
import type { Unsubscribe, WidgetDef } from './widgetHandle'

/**
 * The read view of a node definition. Frozen and inert, like every read here.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface NodeDef {
  readonly type: string
  readonly title: string
  readonly category: string
  readonly description: string
  readonly inputs: readonly Readonly<{ name: string; type: string }>[]
  readonly outputs: readonly Readonly<{ name: string; type: string }>[]
  readonly isOutputNode: boolean
  /** Which pack supplied it, when the backend reports one. */
  readonly source: string | undefined
}

/**
 * Node output as it arrives from the backend.
 *
 * `raw` carries everything else verbatim — ADR 0007's passthrough schema
 * guarantees custom output keys survive, so a pack reading a bespoke key keeps
 * working.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface ExecutionResult {
  readonly images: readonly Readonly<Record<string, unknown>>[]
  readonly text: readonly string[]
  readonly raw: Readonly<Record<string, unknown>>
}

/**
 * A preview frame the backend produced while this node was running.
 *
 * Per node rather than per channel, deliberately. Packs currently subscribe to
 * `b_preview_with_metadata` *and* `b_preview`, track the executing node id in a
 * module global to correlate the second one, and probe
 * `serverSupportsFeature('supports_preview_metadata')` to decide which to
 * trust — all to answer "is this frame mine?". Answering it once here removes
 * the global, and with it the mis-attribution when two nodes preview at once.
 */
export interface PreviewFrame {
  readonly blob: Blob
  /** Object URL for the blob, revoked when the next frame arrives. */
  readonly url: string
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface ConnectionChangeEvent {
  readonly side: 'input' | 'output'
  readonly index: number
  readonly connected: boolean
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface NodeDefBuilder {
  /** Current state of the definition, after any earlier extensions ran. */
  readonly def: NodeDef

/**
   * Fires once the node exists *and is addressable* — after it joins a graph.
   *
   * Deliberately not litegraph's `onNodeCreated`, which runs inside
   * `createNode()` before the node has an id, a graph, or store registration.
   * A handle is id-backed, so at that moment there is nothing to hand back, and
   * widget writes would land on an unregistered node and be lost on insert.
   */
  onCreated(callback: (node: NodeHandle) => void): void // 943 packs
  onExecuted(
    callback: (node: NodeHandle, result: ExecutionResult) => void
  ): void // 497 packs
  onConfigured(
    callback: (node: NodeHandle, data: Record<string, unknown>) => void
  ): void // 429 packs
  onConnectionsChanged(
    callback: (node: NodeHandle, event: ConnectionChangeEvent) => void
  ): void // 223 packs
  onRemoved(callback: (node: NodeHandle) => void): void // 158 packs
  /** Preview frames for this node, already correlated. */
  onPreview(callback: (node: NodeHandle, frame: PreviewFrame) => void): void
  /**
   * Contributes the pack's own state to the saved node.
   *
   * The returned object is merged into the serialized node, and comes back
   * through `onConfigured`. Only keys the pack owns: core fields are not
   * writable from here, because a pack must not be able to change what the
   * workflow means.
   */
  onSerialize(callback: (node: NodeHandle) => Record<string, unknown>): void
  /**
   * Vetoes or permits an incoming connection *before* it is wired.
   *
   * Distinct from `onConnectionsChanged`, which fires after the fact — packs
   * use the pre-hook to refuse an incompatible link or relabel a slot while
   * the type is still known. Returning `false` refuses.
   */
  onBeforeConnect(
    callback: (node: NodeHandle, event: BeforeConnectEvent) => boolean | void
  ): void
  /** Adds an entry to this node type's context menu. */
  addMenuItem(item: NodeMenuItem): void
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface BeforeConnectEvent {
  readonly side: 'input' | 'output'
  readonly index: number
  /** The node at the other end, when one is known. */
  readonly peerNodeId: string | undefined
  readonly peerType: string | undefined
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface NodeMenuItem {
  readonly label: string
  run(node: NodeHandle): void
}

/**
 * Which definitions an extension applies to.
 *
 * Indexed rather than run-and-return: this predicate is almost always the guard
 * clause the pack already had at the top of its hook.
 */
export type DefSelector =
  | string
  | readonly string[]
  | RegExp
  /**
   * A `RegExp` category covers the prefix filter 53 packs open their hook with
   * (`nodeData.category.startsWith('KJNodes')` → `{ category: /^KJNodes/ }`).
   */
  | { readonly category: string | RegExp }

/**
 * A node type the pack owns, declared rather than subclassed.
 *
 * 86 packs (18.2% of installs) do this today with `extends LGraphNode` +
 * `LiteGraph.registerNodeType`, which is OOP entity modelling — the thing ADR
 * 0008 rules out. Here the definition is plain data; the class behind it is an
 * internal detail of this layer, never the pack's.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface NodeDefinition {
  readonly type: string
  readonly title?: string
  readonly category?: string
  readonly description?: string
  readonly inputs?: readonly { name: string; type: string }[]
  readonly outputs?: readonly { name: string; type: string }[]
  readonly widgets?: readonly WidgetDef[]
  /**
   * `'frontend'` nodes never reach the backend: they are resolved away at
   * prompt time by the resolution system, or simply omitted.
   */
  readonly execution?: 'backend' | 'frontend'
  /**
   * Answers what each output resolves to, purely, over a read-only view.
   * See `resolution.ts` — this replaces `applyToGraph`, which mutated the
   * live graph mid-serialize.
   */
  readonly resolve?: Resolver

export interface DefRegistry {
  /**
   * Registers a node type the pack owns. Returns a handle that unregisters
   * it — which `LiteGraph.registerNodeType` never offered.
   */
  define(definition: NodeDefinition): Unsubscribe
  get(type: string): NodeDef | undefined
  all(): readonly NodeDef[]
  has(type: string): boolean
  extend(
    selector: DefSelector,
    apply: (builder: NodeDefBuilder) => void
  ): Unsubscribe
}

// ─── graphHandle.ts ──────────────────────────────────────────────

/**
 * `GraphHandle` — the root of the public graph surface, and the place where the
 * per-node collections are composed and cached.
 *
 * This is the only module that knows how the pieces fit together; everything
 * below it is independently testable.
 */
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { toNodeId } from '@/types/nodeId'

import { ComfyApiError } from './errors'
import { createNodeHandles } from './nodeHandle'
import type { NodeHandle } from './nodeHandle'
import {
  createInputCollection,
  createOutputCollection,
  toLinkInfo
} from './slotHandle'
import type {
  InputSlotHandle,
  LinkInfo,
  OutputSlotHandle,
  SlotCollection
} from './slotHandle'
import { createWidgetCollection, createWidgetHandles } from './widgetHandle'
import type { WidgetCollection } from './widgetHandle'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface NodeInit {
  title?: string
  position?: { x: number; y: number }
}

export interface GraphHandle {
  readonly id: string
  node(id: string): NodeHandle | undefined
  nodes(): readonly NodeHandle[]
  nodesOfType(type: string): readonly NodeHandle[]
  add(type: string, init?: NodeInit): NodeHandle
  remove(id: string): boolean
  links(): readonly LinkInfo[]
  /**
   * The nodes the user currently has selected.
   *
   * 15 packs read `canvas.selected_nodes` or `selectedItems` for this — a
   * canvas internal, and the canvas is exactly what Nodes 2.0 replaces.
   * Selection is a property of the document, so it is asked of the graph.
   */
  selection(): readonly NodeHandle[]
  /** Diagnostics: live handle-cache slots across all kinds. */
  readonly cacheSize: number
}

// ─── nodeHandle.ts ───────────────────────────────────────────────

/**
 * `NodeHandle` — the public view of a graph node.
 *
 * Bound to `LGraphNode` here, but nothing about that is observable from the
 * handle: it resolves by id on every access and exposes only the declared
 * surface. Internals can be refactored without breaking the contract, which is
 * the entire reason this layer exists.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  LGraphEventMode,
  RenderShape
} from '@/lib/litegraph/src/types/globalEnums'
import { toNodeId } from '@/types/nodeId'

import { createHandleFactory } from './closedProxy'
import type { HandleCommon } from './closedProxy'
import type {
  InputSlotHandle,
  OutputSlotHandle,
  SlotCollection
} from './slotHandle'
import type { WidgetCollection } from './widgetHandle'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type NodeMode = 'always' | 'never' | 'bypass' | 'on-event' | 'on-trigger'
/** @knipIgnoreUnusedButUsedByCustomNodes */
export type NodeShape = 'default' | 'box' | 'round' | 'circle' | 'card'

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

export interface NodeSnapshot {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly mode: NodeMode
  readonly collapsed: boolean
  readonly pinned: boolean
  readonly color: string | undefined
  readonly bgColor: string | undefined
  readonly shape: NodeShape
  readonly position: Point
  readonly size: Size
}

/**
 * Shapes follow `src/types/extensionV2.ts`, the agreed extension contract:
 * accessor methods rather than properties, so a read can be a store query and
 * a write can dispatch a command.
 */
export interface SizeConstraints {
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  /** Grow to fit content rather than holding a fixed height. */
  autoHeight?: boolean
}

export interface NodeHandle extends HandleCommon {
  readonly id: string
  readonly type: string
  readonly comfyClass: string

/**
   * Whether this node emits `widgets_values` when the workflow is serialized.
   *
   * Writable because packs vary it per node type, and the value is part of the
   * wire format — a conversion that could not set it would change what the
   * saved workflow contains.
   */
  isSerializingWidgets(): boolean
  setSerializeWidgets(serialize: boolean): void

  getPosition(): Point
  setPosition(pos: Point): void
  getSize(): Size
  setSize(size: Size): void
  /**
   * Declares how the node may be sized, instead of re-asserting it per frame.
   *
   * 39 packs recompute size inside a draw or resize callback, which is both a
   * per-frame cost and a fight with the layout. `autoHeight` is usually the
   * real intent: the pack mounted something of unknown height and wants the
   * node to fit it.
   */
  setSizeConstraints(constraints: SizeConstraints): void
  getSizeConstraints(): Readonly<SizeConstraints>

  readonly inputs: SlotCollection<InputSlotHandle>
  readonly outputs: SlotCollection<OutputSlotHandle>
  readonly widgets: WidgetCollection
  snapshot(): Readonly<NodeSnapshot> | undefined
  remove(): void
}

/** Per-node collections, supplied by the graph layer that owns their caches. */
export interface NodeCollections {
  inputs(nodeId: string): SlotCollection<InputSlotHandle>
  outputs(nodeId: string): SlotCollection<OutputSlotHandle>
  widgets(nodeId: string): WidgetCollection
}

// ─── resolution.ts ───────────────────────────────────────────────

/**
 * Frontend-node resolution — the system that turns "virtual" nodes into
 * ordinary links and values at prompt time.
 *
 * This replaces `isVirtualNode` + `applyToGraph()`, which runs pack callbacks
 * that mutate the live graph in the middle of serialization
 * (`executionUtil.ts:38` — core does it too). Under ECS that is a system with
 * side effects: not replayable, corrupts the document if it throws halfway,
 * and syncs phantom mutations under CRDT.
 *
 * Here resolution is a pure derivation. A pack's resolver answers a question
 * about its own outputs against a read-only view; this pass follows the
 * answers (Get → Set → Reroute → …) to a fixpoint. Nothing is written
 * anywhere: a resolver that throws poisons one prompt build and the graph is
 * untouched, which is the property `applyToGraph` structurally cannot have.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { inputLink } from '@/lib/litegraph/src/node/slotLinks'
import { toNodeId } from '@/types/nodeId'

import type { WidgetValue } from './widgetHandle'

/**
 * "Whatever feeds this input." The only way one resolution names another.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface InputRef {
  readonly nodeId: string
  readonly input: number
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type OutputResolution =
  | { readonly omit: true }
  | { readonly forwardTo: InputRef }
  | { readonly literal: WidgetValue }

/**
 * What a resolver may see. Reads only — there is nothing here that writes.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface ResolvedNodeView {
  readonly id: string
  readonly type: string
  widgetValue(name: string): WidgetValue | undefined
  input(ref: string | number): InputRef | undefined
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface ResolveView {
  readonly self: ResolvedNodeView
  nodesOfType(type: string): readonly ResolvedNodeView[]
}

export type Resolver = (view: ResolveView) => Record<string, OutputResolution>

/** Where an output ends up after every frontend node in the chain resolves. */
export type ResolvedSource =
  | {
      readonly kind: 'output'
      readonly nodeId: string
      readonly output: number
    }
  | { readonly kind: 'literal'; readonly value: WidgetValue }
  | { readonly kind: 'omitted'; readonly reason: string }

// ─── slotHandle.ts ───────────────────────────────────────────────

/**
 * Slot handles and connectivity.
 *
 * Replaces the deleted `input.link` / `output.links` mirrors. Reads go through
 * the link store via `slotLinks`, and every list-shaped read is a frozen
 * snapshot — so disconnecting while iterating is safe, which is precisely what
 * the old mutable-array mirror made hazardous.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { inputLink, outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { useLinkStore } from '@/stores/linkStore'
import { toNodeId } from '@/types/nodeId'

import { ComfyApiError } from './errors'
import { describeSlotRef, resolveSlotRef, slotIdOf } from './slotRef'
import type { SlotId, SlotRef } from './slotRef'

export interface LinkInfo {
  readonly id: string
  readonly sourceNodeId: string
  readonly sourceSlotId: SlotId
  readonly targetNodeId: string
  readonly targetSlotId: SlotId
  readonly type: string
  /** Position at snapshot time. Do not store across mutations. */
  readonly sourceIndex: number
  readonly targetIndex: number
}

/**
 * Fields a pack may change on an existing slot.
 *
 * Applied atomically as one command, so a retype-plus-rename is a single undo
 * step rather than two. Retyping deliberately **keeps existing links**: dynamic
 * retyping (`*` -> `MODEL`) is the whole point for `SetNode`-style packs, and
 * silently dropping connections is the failure mode this API exists to end.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface SlotPatch {
  name?: string
  label?: string | undefined
  type?: string
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SlotSnapshot {
  readonly id: SlotId
  readonly index: number
  readonly name: string
  readonly type: string
  readonly label: string | undefined
  readonly isConnected: boolean
}

export interface InputSlotHandle {
  readonly id: SlotId
  /** Volatile — shifts when other slots are added or removed. */
  readonly index: number
  readonly name: string
  readonly type: string
  readonly label: string | undefined
  readonly isConnected: boolean
  /** Whether this input is the socket form of a widget. */
  readonly isWidgetInput: boolean
  link(): LinkInfo | undefined
  source(): { nodeId: string; outputIndex: number } | undefined
  disconnect(): boolean
  modify(patch: SlotPatch): void
  /** Replaces `{...input}`, which now yields nothing useful. */
  snapshot(): Readonly<SlotSnapshot>
}

export interface OutputSlotHandle {
  readonly id: SlotId
  readonly index: number
  readonly name: string
  readonly type: string
  readonly label: string | undefined
  readonly isConnected: boolean
  /** Frozen snapshot — safe to iterate while disconnecting. */
  links(): readonly LinkInfo[]
  targets(): readonly { nodeId: string; inputIndex: number }[]
  connectTo(targetNodeId: string, input: SlotRef): LinkInfo | undefined
  disconnect(targetNodeId?: string): boolean
  modify(patch: SlotPatch): void
  /**
   * Moves every link on this output to another output of the same node,
   * **preserving link ids**.
   *
   * Disconnect-and-reconnect is not equivalent: it allocates new ids, so the
   * serialized workflow changes. Packs that re-home their own outputs during a
   * migration depend on identity being kept.
   *
   * Slot types are **not** re-validated. The real-world sequence moves links
   * off an output and then retypes it, so enforcing compatibility mid-move
   * would reject exactly the case this exists for.
   */
  moveLinksTo(target: SlotRef): readonly LinkInfo[]
  snapshot(): Readonly<SlotSnapshot>
}

export interface SlotCollection<THandle> {
  readonly length: number
  get(ref: SlotRef): THandle | undefined
  byId(id: SlotId): THandle | undefined
  byName(name: string): THandle | undefined
  /** Explicit positional access. */
  at(index: number): THandle | undefined
  all(): readonly THandle[]
  ids(): readonly SlotId[]
  names(): readonly string[]
  /**
   * Adds a slot. 18 packs grow their inputs as the last one fills — the
   * "Multi" combiner pattern — which needed `node.addInput` until now.
   */
  add(name: string, type: string): THandle
  /**
   * Removes a slot by reference. Any link into it is dropped, as it would be
   * on the legacy path.
   */
  remove(ref: SlotRef): boolean
  [Symbol.iterator](): Iterator<THandle>
}

// ─── slotRef.ts ──────────────────────────────────────────────────

/**
 * Slot identity and reference resolution.
 *
 * An index is a *position*, not an identity: it shifts whenever another slot is
 * inserted or removed, which is exactly what dynamic-slot packs do. So slots get
 * a stable `SlotId`, and positional access must be written explicitly.
 */
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'

import { ComfyAmbiguousSlotError } from './errors'

export type SlotId = string & { readonly __brand: 'SlotId' }

/**
 * A slot reference: a string (id or name), or an explicit `{ index }`.
 *
 * A bare `number` is deliberately not accepted so positional access is visible
 * at the call site and greppable:
 *
 *     output.connectTo(node, 'image')       // by name — preferred
 *     output.connectTo(node, { index: 0 })  // by position — explicit
 */
export type SlotRef = SlotId | string | { readonly index: number }

export interface ResolveOptions {
  /**
   * Whether the backend supplies slot names yet. While false, a canonical
   * integer string resolves positionally, so `'0'` addresses slot 0 and call
   * sites need no rewrite once names arrive.
   *
   * Retire this together with the release that ships names — until then a pack
   * passing `'2'` meaning a name would silently bind slot 2.
   */
  readonly namedSlotsAvailable: boolean
}

// ─── widgetHandle.ts ─────────────────────────────────────────────

/**
 * Widget handles and the per-node widget collection.
 *
 * This is the surface that retires the largest cohort of breakage:
 * `widgets.splice()` / `widgets = [...]` / `widgets.push()` reordering, and the
 * `widget.widgetType = 'converted-widget'` hack whose real intent was always "hide
 * this widget". Both now have first-class, order-safe replacements.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import { getWidgetIds } from '@/lib/litegraph/src/utils/widget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'

import { createHandleFactory } from './closedProxy'
import type { HandleCommon } from './closedProxy'
import { ComfyApiError } from './errors'

export type WidgetValue = string | number | boolean | object | undefined

/** @knipIgnoreUnusedButUsedByCustomNodes */
/**
 * Shapes follow `src/types/extensionV2.ts`, the agreed extension contract.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 * Accessor methods rather than properties, so a read can be a store query and
 * a write can dispatch a command.
 */
export interface WidgetHandle extends HandleCommon {
  readonly name: string
  readonly widgetType: string

/** Replaces the `type = 'converted-widget'` hack. Value is retained. */
  setHidden(hidden: boolean): void
  getOptions(): Readonly<IWidgetOptions> | undefined
  setOption(key: string, value: unknown): void
  setLabel(label: string): void

  isDisabled(): boolean
  setDisabled(disabled: boolean): void
  isSerialized(): boolean

  /**
   * Replaces capture-and-chain on `widget.callback`, which 1,000+ sites do and
   * which silently drops an earlier pack's listener whenever one forgets to
   * call through. Listeners here are additive and independent.
   */
  on(
    event: 'change',
    listener: (value: WidgetValue, oldValue: WidgetValue) => void
  ): Unsubscribe
  on(event: 'removed', listener: () => void): Unsubscribe
}

export type Unsubscribe = () => void

/** `nodeId` and widget name, joined by a character neither may contain. */
const SEP = ' '
const compositeKey = (nodeId: string, name: string) => `${nodeId}${SEP}${name}`

function findWidget(
  node: LGraphNode | undefined,
  name: string
): IBaseWidget | undefined {
  return node?.widgets?.find((w) => w.name === name)
}

export function createWidgetHandles(
  getGraph: () => LGraph | null | undefined,
  namespace = ''
) {
  const resolveNode = (nodeId: string) =>
    getGraph()?.getNodeById(toNodeId(nodeId)) ?? undefined

  const factory = createHandleFactory<IBaseWidget>(
    {
      kind: 'widget',
      props: {
        name: { get: (w) => w.name },
        widgetType: {
          get: (w) => w.type,
          readonlyHint:
            'Widget type is identity. To hide a widget, call setHidden(true).'
        }
      },
      methods: {
        getValue: (w) => w.value as WidgetValue,
        setValue: (w, ...args) => {
          const previous = w.value as WidgetValue
          w.value = args[0] as IBaseWidget['value']
          notify(w, w.value as WidgetValue, previous)
        },
        isHidden: (w) => w.hidden ?? false,
        setHidden: (w, ...args) => {
          w.hidden = Boolean(args[0])
        },
        isDisabled: (w) => w.disabled ?? false,
        setDisabled: (w, ...args) => {
          w.disabled = Boolean(args[0])
        },
        setLabel: (w, ...args) => {
          w.label = args[0] === undefined ? undefined : String(args[0])
        },
        isSerialized: (w) => w.serialize ?? true,
        on: (w, ...args) => {
          const [event, listener] = args as unknown as [
            'change' | 'removed',
            (...a: unknown[]) => void
          ]
          if (event === 'change') ensureCallbackBridge(w)
          const set = event === 'change' ? slots(w).change : slots(w).removed
          ;(set as Set<unknown>).add(listener)
          return () => (set as Set<unknown>).delete(listener)
        },
        // Reads snapshot accessor values by design — a frozen copy must be
        // inert. Use `setOptions` to preserve live getters when writing.
        getOptions: (w) => Object.freeze({ ...w.options }),
        setOption: (w, ...args) => {
          const [key, value] = args as unknown as [string, unknown]
          const patch = { [key]: value } as Partial<IWidgetOptions>
          // Descriptor-preserving merge. Spreading would invoke any accessor
          // and freeze its result: packs commonly define `values` as a live
          // getter for dynamic combos, and a spread silently pins it to a
          // one-time snapshot.
          w.options = Object.defineProperties(
            {},
            {
              ...Object.getOwnPropertyDescriptors(w.options ?? {}),
              ...Object.getOwnPropertyDescriptors(patch)
            }
          ) as IWidgetOptions
        }
        // Removal is resolved from the key, not from the widget: reaching
        // through `w.node` would be exactly the internal coupling this layer
        // exists to remove.
      }
    },
    (key) => {
      const [nodeId, name] = key.split(SEP)
      return findWidget(resolveNode(nodeId), name)
    },
    namespace
  )

  /**
   * Listeners, keyed by the widget object.
   *
   * Not by name: a widget removed and recreated under the same name is a
   * different widget, and a listener left over from the old one would fire for
   * a widget its owner never saw. A WeakMap also lets the entry go when the
   * widget does.
   */
  const listeners = new WeakMap<
    object,
    {
      change: Set<(v: WidgetValue, o: WidgetValue) => void>
      removed: Set<() => void>
    }
  >()

  const slots = (w: object) => {
    let found = listeners.get(w)
    if (!found) {
      found = { change: new Set(), removed: new Set() }
      listeners.set(w, found)
    }
    return found
  }

  function notify(w: object, value: WidgetValue, previous: WidgetValue) {
    if (value === previous) return
    for (const listener of listeners.get(w)?.change ?? []) {
      listener(value, previous)
    }
  }

  /**
   * Routes litegraph's own callback into the listener set.
   *
   * Wrapped once per widget, and the pack's existing callback is still called:
   * during the migration a converted file and an unconverted one may share a
   * widget.
   */
  function ensureCallbackBridge(w: IBaseWidget) {
    const bridged = w as IBaseWidget & { [BRIDGED]?: boolean }
    if (bridged[BRIDGED]) return
    bridged[BRIDGED] = true
    const original = w.callback
    w.callback = function (this: unknown, value, ...rest) {
      const previous = w.value as WidgetValue
      original?.apply(this as never, [value, ...rest] as never)
      notify(w, value as WidgetValue, previous)
    } as IBaseWidget['callback']
  }

  /** Removes a widget and keeps the store's render order in step. */
  function removeWidget(nodeId: string, name: string): boolean {
    const node = resolveNode(nodeId)
    const widget = findWidget(node, name)
    if (!node || !widget) return false
    node.removeWidget(widget)
    for (const listener of listeners.get(widget)?.removed ?? []) listener()
    listeners.delete(widget)
    return true
  }

  return {
    removeWidget,
    handleFor: (nodeId: string, name: string) =>
      factory.handleFor(compositeKey(nodeId, name)) as WidgetHandle,
    liveHandleFor: (nodeId: string, name: string) =>
      factory.liveHandleFor(compositeKey(nodeId, name)) as
        | WidgetHandle
        | undefined,
    prune: () => factory.prune(),
    get cacheSize() {
      return factory.cacheSize
    }
  }
}

/** Marks a widget whose callback has already been bridged to listeners. */
const BRIDGED = Symbol('comfy.widget.bridged')

/** A widget whose body the pack renders itself. */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface MountDef {
  readonly name: string
  /**
   * Fills the mounted container. Called once, with an element already attached
   * to the node.
   */
  render(container: HTMLElement): void
  /** Releases anything `render` retained — listeners, timers, observers. */
  destroy?(): void
  /** Reserved height in graph units. Omit to size to content. */
  readonly height?: number
  readonly hidden?: boolean
  /** Mounted widgets hold no value by default, so nothing is written. */
  readonly serialize?: boolean
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface CanvasDef {
  readonly name: string
  /** Reserved height in pixels. Omit to size to the node's width. */
  readonly height?: number
  draw(context: CanvasRenderingContext2D, size: readonly [number, number]): void
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface CanvasHandle {
  readonly widget: WidgetHandle
  /** Redraws now. Call when the data behind the drawing changed. */
  redraw(): void
}

/** Everything needed to create a widget. */
export interface WidgetDef {
  readonly type: string
  readonly name: string
  readonly value?: WidgetValue
  readonly options?: Partial<IWidgetOptions>
  /** Display-only widgets — replaces the readOnly/opacity DOM fiddling. */
  readonly disabled?: boolean
  readonly hidden?: boolean
  /**
   * Whether the value is written into the saved workflow.
   *
   * Replaces `widget.serializeValue = async () => {}`, the idiom packs use to
   * keep a derived readout out of `widgets_values`. Orthogonal to `hidden`.
   */
  readonly serialize?: boolean
}

export interface WidgetCollection {
  readonly length: number
  get(name: string): WidgetHandle | undefined
  at(index: number): WidgetHandle | undefined
  all(): readonly WidgetHandle[]
  names(): readonly string[]
  /**
   * Replaces splice/assign reordering. `names` must be a permutation of the
   * current names — a partial list throws rather than silently dropping
   * widgets, which is how the array-splice idiom lost them.
   */
  reorder(names: readonly string[]): void
  move(name: string, toIndex: number): void
  /**
   * Creates a widget on this node.
   *
   * The counterpart to `remove` — packs that rebuild a readout widget do
   * remove-then-create, and without this only half the operation has a
   * destination, which makes the conversion cosmetic.
   */
  add(def: WidgetDef): WidgetHandle
  /**
   * Mounts an element on the node and hands it to the pack to fill.
   *
   * The replacement for `addDOMWidget`, and the destination for hand-painted
   * canvas controls. Across kjnodes' canvas editors the drawing is rectangles,
   * images, straight lines and text — all DOM primitives — but a pack that
   * wants to keep its existing `ctx` code can append a `<canvas>` to the
   * container and carry it over unchanged.
   *
   * The gain is not the drawing, it is the input: these editors hand-roll
   * hit-testing against bounding boxes because canvas gives them nothing to
   * attach a listener to. Mounted in the DOM, pointer events land on the
   * element and most of that code goes away.
   */
  mount(def: MountDef): WidgetHandle
  /**
   * A per-node drawing surface, and the destination for `onDrawForeground`.
   *
   * Works under both renderers without the pack knowing which it is on: the
   * canvas is a DOM element, which the legacy renderer positions over the
   * graph canvas and Nodes 2.0 renders directly. That is the whole reason it
   * is a mounted element rather than a hook into the graph's own context —
   * drawing into the shared context is what ties a pack to the old renderer.
   *
   * `draw` is called on mount, on resize, and whenever `redraw()` is called.
   */
  canvas(def: CanvasDef): CanvasHandle
  remove(name: string): boolean
  [Symbol.iterator](): Iterator<WidgetHandle>
}