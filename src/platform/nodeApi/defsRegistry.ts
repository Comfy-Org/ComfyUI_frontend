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
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'
import { reportError } from '@/platform/telemetry/reportError'
import { getLinkTypeColor } from '@/utils/litegraphUtil'
import { st } from '@/i18n'
import { normalizeI18nKey } from '@/utils/formatUtil'

import { ComfyApiError } from './errors'
import type { NodeHandle, Size } from './nodeHandle'
import { slotShapeOf } from './slotHandle'
import type { SlotShape } from './slotHandle'
import type { Resolver, Supplier } from './resolution'
import { addDeclaredWidget } from './widgetHandle'
import type { Unsubscribe, WidgetDef } from './widgetHandle'
import { createWidgetTypeRegistrar } from './widgetTypes'
import type { WidgetTypeDef } from './widgetTypes'

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
  readonly inputs: readonly Readonly<{
    name: string
    type: string
    /** The translated caption core renders for this input, when it differs. */
    localizedName?: string
    /** The declared choices for a COMBO input, in backend order. */
    values?: readonly (string | number)[]
    /**
     * The input's declaration dict, verbatim from the backend.
     *
     * Same passthrough reasoning as `ExecutionResult.raw`: a pack declares its
     * own keys on its own Python input spec and reads them back here to drive
     * frontend behaviour, so discarding unrecognised keys breaks the pack
     * against its own data. Carries `default`, `min`, `max` and the like too.
     */
    options: Readonly<Record<string, unknown>>
  }>[]
  readonly outputs: readonly Readonly<{ name: string; type: string }>[]
  readonly isOutputNode: boolean
  /**
   * The node's `hidden` input declarations, verbatim.
   *
   * Deliberately not merged into {@link inputs}: a hidden input is not a slot,
   * and listing it as one would put a connectable input on the node for
   * something the server fills in.
   *
   * Packs ship their own data here and read it back — easy-use and
   * tinyterraNodes both carry an XY-plot axis catalogue as
   * `input.hidden.plot_dict[0]`, on their own key, from their own Python spec.
   * That is the same passthrough reasoning `inputs[].options` already rests on,
   * and dropping it broke both packs against their own data.
   *
   * These are declarations, not values. `PROMPT`, `UNIQUE_ID` and
   * `EXTRA_PNGINFO` appear here as the type markers the node asked for; the
   * server substitutes the real thing at execution time and it never passes
   * through here.
   */
  readonly hidden: Readonly<Record<string, unknown>>
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
  /**
   * The node at the other end, or `undefined` on a disconnect.
   *
   * Packs read `link_info.origin_id` to decide what the new neighbour means —
   * retype a slot to match it, adopt its label. Knowing only that *something*
   * connected forced a re-walk of the whole graph to find out what.
   */
  readonly peerNodeId?: string
  /** The slot index at the other end, or `undefined` on a disconnect. */
  readonly peerIndex?: number
}

/**
 * The only change a node extension may make to one queued API prompt.
 *
 * Inputs are named from that node type's own backend declaration. The saved
 * workflow is untouched; the prompt builder removes these names only from the
 * executable payload it is assembling now.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface PromptInputProjection {
  readonly omitInputs: readonly string[]
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type PromptInputProjector = (
  node: NodeHandle
) => PromptInputProjection | Promise<PromptInputProjection>

export interface NodeDefBuilder {
  /** Current state of the definition, after any earlier extensions ran. */
  readonly def: NodeDef

  setTitle(title: string): void
  setCategory(category: string): void
  /**
   * Declares that this node type never reaches the backend.
   *
   * `defs.define` takes `execution: 'frontend'` for a type the pack owns, but
   * packs also mark *backend-registered* types frontend-only — a tools or
   * control node that exists to drive other nodes and must not appear in the
   * prompt. Without this they reach for `node.isVirtualNode`, and dropping that
   * line puts a new node into `graphToPrompt`, which is a wire-format break.
   *
   * Supply `resolve` when the node carries a value through to something else;
   * omit it and the node is simply left out. See `resolution.ts` — `resolve` is
   * pure over a read-only view and must not mutate the graph.
   */
  setExecution(execution: 'backend' | 'frontend', resolve?: Resolver): void
  /**
   * Declares what this node feeds into *other* nodes' unconnected inputs.
   *
   * The counterpart of `setExecution`'s `resolve`, which answers only "what
   * feeds my own outputs" and is never called for a node with none. Broadcast
   * packs are the reverse: they name inputs on nodes that are not themselves,
   * and discover those edges rather than declaring them.
   *
   * Available here and not only on `defs.define` because the types that
   * broadcast are registered by the pack's Python, and `defs.define` refuses a
   * type that already exists — which left `supply` unreachable for every pack
   * that actually needed it.
   *
   * Not gated on `setExecution('frontend')`: feeding somebody else and being
   * skipped by the prompt builder are separate questions, and a node may
   * legitimately both execute and broadcast.
   */
  setSupply(supply: Supplier): void
  addWidget(def: WidgetDef): void
  hideWidget(name: string): void

  // Behaviour hooks, ordered by measured usage across the 1,265 packs.
  /**
   * Fires once the node exists *and is addressable* — after it joins a graph.
   *
   * Deliberately not litegraph's `onNodeCreated`, which runs inside
   * `createNode()` before the node has an id, a graph, or store registration.
   * A handle is id-backed, so at that moment there is nothing to hand back, and
   * widget writes would land on an unregistered node and be lost on insert.
   */
  onCreated(callback: (node: NodeHandle, event: NodeCreatedEvent) => void): void // 943 packs
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
  /**
   * The node was resized, by the user or by a layout pass.
   *
   * Packs hung a `ResizeObserver` on their mounted element to notice this,
   * which fires for the element rather than the node and misses a resize that
   * does not change the element.
   */
  onResized(callback: (node: NodeHandle, size: Size) => void): void
  /**
   * The pointer entered or left the node.
   *
   * Packs read `canvas.node_over` or set `node.mouseOver` to rebuild a list
   * the moment the pointer arrives, or to decide which node a tooltip belongs
   * to. Both are canvas internals, and the canvas is what Nodes 2.0 replaces.
   */
  onHover(callback: (node: NodeHandle, hovering: boolean) => void): void
  /**
   * The node was double-clicked.
   *
   * Deliberately carries no coordinates. Hit-testing a pointer against
   * node-local geometry is a pack drawing its own front end; the published
   * answer is `widgets.mount` and ordinary DOM events on the element you own.
   */
  onDoubleClick(callback: (node: NodeHandle) => void): void
  /**
   * Whether this node can accept the current browser drag.
   *
   * The event is the browser's data-transfer surface, not a renderer object.
   * Returning `true` makes both node renderers present and route the drop.
   */
  onDragOver(
    callback: (node: NodeHandle, event: DragEvent) => boolean | void
  ): void
  /** Handles a drop the node accepted. Returning `true` claims it. */
  onDrop(
    callback: (
      node: NodeHandle,
      event: DragEvent
    ) => boolean | void | Promise<boolean | void>
  ): void
  /**
   * A property the user edited in the node's properties panel.
   *
   * Packs used `onPropertyChanged` to keep a hand-entered value sane — rgthree
   * clamps a seed's `randomMax` as it is typed. litegraph's own callback can
   * only veto, reverting to the previous value, which throws the user's input
   * away rather than correcting it. `setValue` replaces it instead, and writes
   * without going back through `setProperty`, so a clamp cannot recurse.
   */
  onPropertyChanged(
    callback: (node: NodeHandle, event: PropertyChangeEvent) => void
  ): void
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
   * Omits declared inputs from this node in the API prompt being built.
   *
   * This is not a prompt rewrite: the callback receives no prompt or input
   * values, may not name another node, and cannot inject replacements. It is
   * awaited on the prompt path so a sandboxed extension answers from its
   * current read-only node snapshot rather than a stale cached value.
   */
  onPromptSerialize(callback: PromptInputProjector): void
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
  /**
   * The user dropped a link on a node's body and the host found no single slot
   * that fits. Wire it yourself and return `true`; return nothing to let the
   * host report the drop unplaceable.
   *
   * For a node whose one slot carries a bundle of values — a context, a pipe —
   * and which wants to unpack it into several of the peer's slots at once. Both
   * ends of the drag are asked, the one the user aimed at first, because the
   * node with the knowledge is the drop target in one direction and the drag's
   * origin in the other.
   *
   * The published alternative to replacing `connectByType` on the prototype,
   * which is how packs did this: that changes link routing for every node in
   * the document, so one pack's convenience became every other pack's
   * behaviour.
   */
  onUnplacedLink(
    callback: (node: NodeHandle, event: UnplacedLinkEvent) => boolean | void
  ): void
  /** Adds an entry to this node type's context menu. */
  addMenuItem(item: NodeMenuItem): void
}

export interface NodeCreatedEvent {
  /**
   * The node arrived carrying saved state — pasted, duplicated, or loaded from
   * a workflow — rather than being made fresh.
   *
   * Read as "was `configure` called on it before it joined the graph", which is
   * what actually distinguishes the cases. Packs overrode `clone()` to reset
   * state a copy should not inherit — a duplicated node keeping the dynamic
   * slots that were fed by the original's upstream, a duplicated reroute born
   * hard-typed and refusing every other type — and `clone()` runs before the
   * node has an id, so there is nothing to hand a pack there.
   */
  readonly restored: boolean
  /**
   * The whole graph was being loaded, so {@link restored} means "came from the
   * saved file" rather than "came from the clipboard".
   *
   * The distinction is the point: a pasted node should drop slots it cannot
   * still be fed through, and a loaded one must keep every one of them or the
   * workflow opens wrong.
   */
  readonly loading: boolean
}

export interface UnplacedLinkEvent {
  /** Which of this node's slots the link would land on. */
  readonly side: 'input' | 'output'
  /** The node at the other end of the drag. */
  readonly peerNodeId: string
  /** The slot on the peer the drag started from. */
  readonly peerIndex: number
  readonly type: string
  /**
   * The user held the modifier that means "overwrite what is already wired".
   *
   * Published because packs read a global keyboard service of their own to get
   * it, and which modifier means this is the host's to decide.
   */
  readonly replaceExisting: boolean
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface BeforeConnectEvent {
  readonly side: 'input' | 'output'
  readonly index: number
  /** The node at the other end, when one is known. */
  readonly peerNodeId: string | undefined
  /** The slot at the other end, when one is known. */
  readonly peerIndex: number | undefined
  readonly peerType: string | undefined
}

/** One entry inside a menu item's submenu. */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface NodeSubMenuItem {
  readonly label: string
  run(node: NodeHandle): void
}

/**
 * One entry of ComfyUI's node palette: the title bar, the body, and the shade
 * a group of that colour is filled with.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export interface NodeColor {
  readonly color: string
  readonly bgColor: string
  readonly groupColor: string
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface NodeMenuItem {
  /**
   * A function when the text depends on the node — packs label entries with
   * the current state ("Unmute 3 nodes"), which a string fixed at
   * registration cannot express.
   */
  readonly label: string | ((node: NodeHandle) => string)
  /**
   * Shown only when this returns true. Without it a pack that wants an entry
   * to appear conditionally has to either show it always or not at all —
   * efficiency-nodes hides its seed submenu when the feature is off, and
   * flattening that to a permanent entry is a worse lie than omitting it.
   */
  when?(node: NodeHandle): boolean
  /** Omit when the item only opens a submenu. */
  run?(node: NodeHandle): void
  /**
   * Turns the entry into a submenu. One level deep, deliberately: every
   * measured pack uses exactly one, and nesting further is a menu design
   * problem rather than an API one.
   *
   * A function when the children depend on the node's current state, which is
   * the common case rather than the exotic one: efficiency-nodes' LoRA Stacker
   * declares fifty `lora_name_N` widgets and lists only the two or three a
   * user has filled. A fixed array would put fifty rows in that menu, which is
   * a different menu, so the alternative to this was omitting the feature.
   */
  readonly items?:
    | readonly NodeSubMenuItem[]
    | ((node: NodeHandle) => readonly NodeSubMenuItem[])
  /**
   * Sort position among this node's pack-added entries. Lower first; entries
   * without one keep registration order, which is module-load order and so
   * depends on import sequence rather than intent.
   */
  readonly order?: number
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
   * A predicate over the definition, for a guard the other forms cannot
   * express — "any node taking a VAE input", which is a shape rather than a
   * name.
   *
   * Deliberately last, and deliberately discouraged. The declarative forms
   * exist because a name check can be indexed, while a predicate has to run for
   * every registered type; with thousands of types that is the boot cost this
   * API set out to remove. Use it only when the guard genuinely reads a def's
   * inputs or outputs.
   */
  | ((def: NodeDef) => boolean)
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
  readonly outputs?: readonly {
    name: string
    type: string
    shape?: SlotShape
  }[]
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
  /**
   * What this node feeds into *other* nodes' unconnected inputs.
   *
   * The broadcast direction: `resolve` cannot express it, because the nodes
   * being fed are not this one and the edges are discovered rather than
   * declared.
   */
  readonly supply?: Supplier

  onCreated?(node: NodeHandle, event: NodeCreatedEvent): void
  onExecuted?(node: NodeHandle, result: ExecutionResult): void
  onConfigured?(node: NodeHandle, data: Record<string, unknown>): void
  onConnectionsChanged?(node: NodeHandle, event: ConnectionChangeEvent): void
  onPropertyChanged?(node: NodeHandle, event: PropertyChangeEvent): void
  onDragOver?(node: NodeHandle, event: DragEvent): boolean | void
  onDrop?(
    node: NodeHandle,
    event: DragEvent
  ): boolean | void | Promise<boolean | void>
  onRemoved?(node: NodeHandle): void
  onSerialize?(node: NodeHandle): Record<string, unknown>
  onPromptSerialize?: PromptInputProjector
}

export interface DefRegistry {
  /**
   * Declares how an input *type* is presented — the replacement for
   * `getCustomWidgets`.
   *
   * Not decoration: the host decides widget-vs-socket purely by whether a type
   * is registered, so an unregistered one turns the input into a socket and
   * drops its value from `widgets_values`. See `widgetTypes.ts`.
   */
  defineWidgetType(type: string, def: WidgetTypeDef): Unsubscribe
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
  /**
   * Asks the host to reload node definitions from the backend.
   *
   * Combo inputs whose values the backend supplies — model lists, LoRA names,
   * sampler names — are captured when definitions load, so a pack that adds a
   * file server-side leaves every open picker showing the old list. This is
   * `app.refreshComboInNodes()`, which packs called after saving a model
   * preview or writing a new file.
   *
   * Refreshing is not free: it refetches every definition. Call it after a
   * change the user made, not on a timer.
   */
  /**
   * The colour links and slots of a type are drawn in.
   *
   * A pack matching the theme in its own DOM — a legend, a chip, a preview —
   * read `LGraphCanvas.link_type_colors` for this. Reading a design token to
   * match is the opposite of drawing your own front end, so it is published;
   * the table itself is not.
   */
  typeColor(type: string): string
  /**
   * The colours behind a name in ComfyUI's node palette — `red`, `pale_blue` —
   * or `undefined` for a name it does not define.
   *
   * Same reasoning as {@link typeColor}, and the same limit: the resolver is
   * published, the table is not. What makes this a design token rather than a
   * renderer internal is that the names are the user's own vocabulary. They
   * pick "green" from a menu; nothing records the word, only the hex it stood
   * for. So a pack offering "mute every red group" cannot match what the user
   * chose without being told which hex "red" meant, and two packs did it by
   * reading `LGraphCanvas.node_colors` directly.
   *
   * Colours move with the palette, names do not. Resolve on use; do not cache
   * the result and do not persist it in a workflow.
   */
  nodeColor(name: string): NodeColor | undefined
  /**
   * Tests an output type against an input type using the host's connection
   * rules, including wildcards and comma-delimited unions.
   */
  isTypeCompatible(outputType: string, inputType: string): boolean
  /**
   * Declares the colour for a data type this pack introduces.
   *
   * Packs shipping their own types — `PIPE_LINE`, `LORA_STACK`, `XYPLOT` —
   * wrote straight into `LGraphCanvas.link_type_colors` so their links were
   * not all grey.
   *
   * Refuses a type the host already colours. That write is global: one pack
   * recolouring `IMAGE` restyles every graph for every other pack and the
   * user has no way to see who did it. Colouring a type you brought is
   * additive; colouring one you did not is not yours to decide.
   */
  setTypeColor(type: string, color: string): Unsubscribe
  refresh(): Promise<void>
  /**
   * Node definitions were reloaded — by this pack, another pack, or the user.
   *
   * The listening half of `refresh()`, and what the `refreshComboInNodes`
   * extension hook gave packs. A pack holding its own cached copy of a combo's
   * values — a model list it filters, a picker it built — needs to rebuild it
   * when the list changes underneath, and the pack that caused the change is
   * usually not this one.
   */
  onRefreshed(listener: () => void): Unsubscribe
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface PropertyChangeEvent {
  readonly name: string
  readonly value: unknown
  readonly previous: unknown
  /** Replaces what is stored. Last writer wins if several packs respond. */
  setValue(value: unknown): void
  /** Discards the edit, restoring `previous`. */
  reject(): void
}

interface Registration {
  readonly selector: DefSelector
  readonly apply: (builder: NodeDefBuilder) => void
  active: boolean
  /**
   * Bound at registration, not at the registry, because one registry is shared
   * by every major: a v1 pack's callback must receive v1 handles even though a
   * v2 pack extended the same type.
   */
  readonly handleFor: (nodeId: string) => NodeHandle
  readonly handleForNode: (node: LGraphNode) => NodeHandle
}

type NodeCallbackKey =
  | 'onAdded'
  | 'onExecuted'
  | 'onConfigure'
  | 'onConnectionsChange'
  | 'onPropertyChanged'
  | 'onResize'
  | 'onMouseEnter'
  | 'onMouseLeave'
  | 'onDblClick'
  | 'onConnectInput'
  | 'onConnectOutput'
  | 'onRemoved'

type NodeCallbackArgs<TKey extends NodeCallbackKey> =
  NonNullable<LGraphNode[TKey]> extends (...args: infer TArgs) => unknown
    ? TArgs
    : never

/**
 * Rejects a selector shape this version does not understand.
 *
 * Without this an unrecognised object simply never matches, so the extension
 * silently does nothing — the worst failure mode available, because the pack
 * looks converted and the behaviour is just gone. Fail at registration instead.
 */
function assertSelector(selector: DefSelector): void {
  const valid =
    typeof selector === 'function' ||
    typeof selector === 'string' ||
    selector instanceof RegExp ||
    Array.isArray(selector) ||
    (typeof selector === 'object' &&
      extensionValue(selector) !== null &&
      'category' in selector)
  if (valid) return
  throw new ComfyApiError(
    `Unrecognised def selector: ${extensionValue(JSON.stringify(selector)) ?? String(selector)}. ` +
      `Expected a type name, an array of type names, a RegExp, or ` +
      `{ category: string | RegExp }.`
  )
}

function matches(selector: DefSelector, def: NodeDef): boolean {
  if (typeof selector === 'function') return selector(def)
  if (typeof selector === 'string') return def.type === selector
  if (selector instanceof RegExp) return matchesPattern(selector, def.type)
  // `Array.isArray` does not narrow a `readonly` array out of a union.
  if ('length' in selector) return selector.includes(def.type)
  const { category } = selector
  return category instanceof RegExp
    ? matchesPattern(category, def.category)
    : def.category === category
}

function matchesPattern(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0
  return pattern.test(value)
}

/** The shape the backend sends. Only the fields the public `NodeDef` exposes. */
interface RawNodeDef {
  name?: string
  display_name?: string
  category?: string
  description?: string
  output?: unknown[]
  output_name?: string[]
  output_node?: boolean
  python_module?: string
  input?: {
    required?: Record<string, unknown>
    optional?: Record<string, unknown>
    hidden?: Record<string, unknown>
  }
}

function toNodeDef(raw: RawNodeDef): NodeDef {
  const nodeType = raw.name ?? ''
  const slotType = (spec: unknown) => {
    const first = Array.isArray(spec) ? spec[0] : undefined
    return Array.isArray(first) ? 'COMBO' : String(first ?? '*')
  }

  const slotOptions = (spec: unknown) => {
    const declared = Array.isArray(spec) ? spec[1] : undefined
    if (!declared || typeof declared !== 'object') return Object.freeze({})
    return Object.freeze({ ...(declared as Record<string, unknown>) })
  }

  const comboValues = (spec: unknown) => {
    if (!Array.isArray(spec)) return undefined
    const declared: readonly unknown[] | undefined = Array.isArray(spec[0])
      ? spec[0]
      : spec[0] === 'COMBO' &&
          spec[1] !== null &&
          typeof spec[1] === 'object' &&
          Array.isArray(spec[1].options)
        ? spec[1].options
        : undefined
    if (!declared) return undefined
    return Object.freeze(
      declared.filter(
        (value): value is string | number =>
          typeof value === 'string' || typeof value === 'number'
      )
    )
  }

  const inputs = Object.entries({
    ...(raw.input?.required ?? {}),
    ...(raw.input?.optional ?? {})
  }).map(([name, spec]) => {
    const values = comboValues(spec)
    const localizedName = st(
      `nodeDefs.${normalizeI18nKey(nodeType)}.inputs.${normalizeI18nKey(name)}.name`,
      name
    )
    return Object.freeze({
      name,
      type: slotType(spec),
      ...(localizedName !== name ? { localizedName } : {}),
      ...(values ? { values } : {}),
      options: slotOptions(spec)
    })
  })

  const outputs = (raw.output ?? []).map((type, index) =>
    Object.freeze({
      name: raw.output_name?.[index] ?? String(type),
      type: String(type)
    })
  )

  return Object.freeze({
    type: nodeType,
    title: raw.display_name ?? raw.name ?? '',
    category: raw.category ?? '',
    description: raw.description ?? '',
    inputs: Object.freeze(inputs),
    outputs: Object.freeze(outputs),
    isOutputNode: raw.output_node ?? false,
    hidden: Object.freeze({ ...(raw.input?.hidden ?? {}) }),
    source: raw.python_module
  })
}

function toExecutionResult(message: unknown): ExecutionResult {
  const raw = (message ?? {}) as Record<string, unknown>
  const text = Array.isArray(raw.text) ? raw.text.map(String) : []
  const images = Array.isArray(raw.images)
    ? (raw.images as Record<string, unknown>[]).map((i) =>
        Object.freeze({ ...i })
      )
    : []
  return Object.freeze({
    images: Object.freeze(images),
    text: Object.freeze(text),
    raw: Object.freeze(raw)
  })
}

/**
 * Serialized fields a pack may not write.
 *
 * Everything that decides what the node *is* or what it will run. A pack's own
 * keys are welcome beside them; overwriting them is not.
 */
const RESERVED_SERIAL_KEYS: ReadonlySet<string> = new Set([
  'id',
  'type',
  'pos',
  'size',
  'flags',
  'order',
  'mode',
  'inputs',
  'outputs',
  'title',
  'properties',
  'widgets_values'
])

/**
 * Type name -> resolver, for the resolution system.
 *
 * Module level for the same reason as the preview subscribers: the prompt
 * builder knows node types, not registry instances.
 */
const frontendResolvers = new Map<string, Resolver>()

type BoundPromptInputProjector = {
  run: PromptInputProjector
  handleFor: (nodeId: string) => NodeHandle
  isActive: () => boolean
}

type PromptInputProjectionPolicy = {
  allowed: ReadonlySet<string>
  projectors: readonly BoundPromptInputProjector[]
}

/**
 * Prompt-only input projections installed for backend node types.
 *
 * Kept module-level because the prompt builder knows the executable node type
 * and id, not which API-major registry installed the extension.
 */
const promptInputProjectors = new Map<string, PromptInputProjectionPolicy>()

/**
 * Colours packs declared, kept apart from the renderer's own table.
 *
 * `colorPaletteService.loadLinkColorPalette` assigns over
 * `LGraphCanvas.link_type_colors` with every known type mapped to `''`, so a
 * pack's colour is wiped whenever the user changes theme. Holding the pack's
 * choice here and re-applying makes it survive; reading from here first makes
 * `typeColor` answer correctly even in the window before it is re-applied.
 */
const packTypeColors = new Map<string, string>()

function applyPackTypeColors(): void {
  for (const [type, color] of packTypeColors) {
    LGraphCanvas.link_type_colors[type] = color
  }
}

/** Called by the host after it loads a colour palette. */
export function reapplyPackTypeColors(): void {
  applyPackTypeColors()
}

const refreshListeners = new Set<() => void>()

/** Called by the host once node definitions have finished reloading. */
export function notifyDefsRefreshed(): void {
  for (const listener of [...refreshListeners]) {
    try {
      listener()
    } catch (error) {
      // One pack's failed rebuild must not stop the packs behind it.
      console.error('[nodeApi] onRefreshed listener threw', error)
      reportError(error, { errorType: 'node_api_refresh_listener_failure' })
    }
  }
}

function onDefsRefreshed(listener: () => void): Unsubscribe {
  refreshListeners.add(listener)
  return () => refreshListeners.delete(listener)
}

/** The resolvers currently registered, for `resolveFrontendNodes`. */
export function frontendResolverMap(): ReadonlyMap<string, Resolver> {
  return frontendResolvers
}

/**
 * Returns the union of inputs this node's extensions omit from this prompt.
 *
 * Validation lives here, at the authority boundary, rather than in packs or
 * the prompt builder. A malformed projection aborts the build with attribution
 * and never degrades to a broader execution graph.
 */
export async function projectedPromptInputOmissions(
  nodeType: string,
  nodeId: string
): Promise<readonly string[]> {
  const policy = promptInputProjectors.get(nodeType)
  if (!policy) return Object.freeze([])

  const omitted = new Set<string>()
  let failure: unknown
  for (const { run, handleFor, isActive } of policy.projectors) {
    if (!isActive()) continue
    let value: unknown
    try {
      value = await run(handleFor(nodeId))
    } catch (error) {
      reportError(error, {
        errorType: 'node_api_extension_callback_failure',
        tags: { node_type: nodeType, hook: 'onPromptSerialize' }
      })
      failure ??= error
      continue
    }
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => key !== 'omitInputs') ||
      !Array.isArray((value as { omitInputs?: unknown }).omitInputs)
    ) {
      throw new ComfyApiError(
        `onPromptSerialize for '${nodeType}' must return only ` +
          `{ omitInputs: string[] }.`
      )
    }

    const names = (value as { omitInputs: unknown[] }).omitInputs
    if (names.length > policy.allowed.size || names.length > 256) {
      throw new ComfyApiError(
        `onPromptSerialize for '${nodeType}' named too many inputs.`
      )
    }
    const local = new Set<string>()
    for (const name of names) {
      if (
        typeof name !== 'string' ||
        name.length === 0 ||
        name.length > 256 ||
        !policy.allowed.has(name)
      ) {
        throw new ComfyApiError(
          `onPromptSerialize for '${nodeType}' named an undeclared input.`
        )
      }
      if (local.has(name)) {
        throw new ComfyApiError(
          `onPromptSerialize for '${nodeType}' repeated input '${name}'.`
        )
      }
      local.add(name)
      omitted.add(name)
    }
  }
  if (failure !== undefined) throw failure
  return Object.freeze([...omitted])
}

/**
 * Type name -> its supplier. Separate from the resolvers because the two
 * answer opposite questions: a resolver is asked what feeds its own outputs,
 * a supplier is asked what it feeds in everybody else.
 */
const frontendSuppliers = new Map<string, Supplier>()

/** The suppliers currently registered, for `resolveSuppliedInputs`. */
export function frontendSupplierMap(): ReadonlyMap<string, Supplier> {
  return frontendSuppliers
}

/**
 * Type name -> its preview listeners.
 *
 * Module level because delivery comes from the app's socket, which knows a node
 * id but not which registry instance registered for it.
 */
const previewSubscribers = new Map<
  string,
  (nodeId: string, frame: PreviewFrame) => void
>()

/**
 * Nodes that were configured before they joined a graph.
 *
 * Weak, so it holds nothing open: an entry lives exactly as long as the node.
 * Module level because it spans the configure and add of one node, and both
 * arrive through prototype patches rather than through any one registry.
 */
const restoredNodes = new WeakSet<object>()

/**
 * Whether a workflow load is in progress.
 *
 * Pushed down from the app layer, which owns that state, rather than reached
 * up for — the same seam the move and change bridges use. Defaults to "no", so
 * a host that never installs it reports paste and load alike as `restored`.
 */
let isLoadingGraph: () => boolean = () => false

export function provideGraphLoadingState(source: () => boolean): void {
  isLoadingGraph = source
}

/**
 * Type name -> its unplaced-link listeners.
 *
 * Module level for the same reason as previews: the offer comes from the
 * canvas, which knows a node and its type but not which registry instance
 * registered for it.
 */
const unplacedLinkSubscribers = new Map<
  string,
  (nodeId: string, event: UnplacedLinkEvent) => boolean
>()

/**
 * Offers a link the host could not place to one end of the drag.
 *
 * `true` means a pack wired it and the host should stay quiet.
 */
export function offerUnplacedLink(
  nodeId: string,
  nodeType: string,
  event: UnplacedLinkEvent
): boolean {
  return unplacedLinkSubscribers.get(nodeType)?.(nodeId, event) ?? false
}

/**
 * Hands a preview frame to whichever node type registered for it.
 *
 * Called by the app when the backend emits a preview. The node type is looked
 * up rather than passed, so the app does not need to know which packs care.
 */
export function deliverPreview(
  nodeId: string,
  nodeType: string,
  frame: PreviewFrame
): void {
  previewSubscribers.get(nodeType)?.(nodeId, frame)
}

export function createDefRegistry(refreshDefinitions?: () => Promise<void>): {
  /** The per-major public face. Handles come from that major's graph. */
  forMajor(
    handleFor: (nodeId: string) => NodeHandle,
    handleForNode?: (node: LGraphNode) => NodeHandle
  ): DefRegistry
  /**
   * Applies every matching extension to a node class being registered.
   *
   * Called by the app from its `beforeRegisterNodeDef` hook — the one place
   * this layer still meets the legacy registration path.
   */
  applyTo(nodeType: { prototype: Partial<LGraphNode> }, raw: unknown): void
} {
  const registrations = new Set<Registration>()
  const known = new Map<string, NodeDef>()

  const defineType = (
    definition: NodeDefinition,
    handleFor: (nodeId: string) => NodeHandle,
    handleForNode: (node: LGraphNode) => NodeHandle
  ): Unsubscribe => {
    const { type } = definition
    if (Object.hasOwn(LiteGraph.registered_node_types, type)) {
      throw new ComfyApiError(
        `A node type named '${type}' is already registered. ` +
          `Pick another name, or unregister the existing one first.`
      )
    }

    const raw: RawNodeDef = {
      name: type,
      display_name: definition.title ?? type,
      category: definition.category ?? 'custom',
      description: definition.description ?? '',
      output: definition.outputs?.map((o) => o.type) ?? [],
      output_name: definition.outputs?.map((o) => o.name) ?? [],
      input: {
        required: Object.fromEntries(
          (definition.inputs ?? []).map((i) => [i.name, [i.type, {}]])
        )
      }
    }

    // The class is this layer's internal detail — the pack declared data, and
    // litegraph happens to want a constructor behind a type name.
    class Defined extends LGraphNode {
      constructor() {
        super(definition.title ?? type)
        // Matches what the host's own node class does. `LGraphNode.serialize`
        // gates `widgets_values` on this, and it defaults to off, so a defined
        // node's widget values were dropped from the saved workflow — silently,
        // and only visible after a reload.
        this.serialize_widgets = true
        for (const input of definition.inputs ?? []) {
          this.addInput(input.name, input.type)
        }
        for (const output of definition.outputs ?? []) {
          this.addOutput(output.name, output.type, slotShapeOf(output.shape))
        }
        for (const widget of definition.widgets ?? []) {
          addDeclaredWidget(this, widget)
        }
      }
    }
    Defined.title = definition.title ?? type
    ;(Defined as unknown as { comfyClass: string }).comfyClass = type
    Defined.prototype.comfyClass = type
    // Compatibility with the current prompt builder while the resolution
    // system replaces applyToGraph: marked virtual so today's serializer omits
    // it from the executable output. Note there is no applyToGraph here.
    if (definition.execution === 'frontend') {
      Defined.prototype.isVirtualNode = true
      // With a resolver, the resolution pass owns the outputs — execution-time
      // link walking stops at the node instead of guessing with the legacy
      // virtual shapes, which cannot express a computed source like Get/Set.
      if (definition.resolve) Defined.prototype.resolutionOwned = true
    }

    // Hooks route through the same registration path as extend(), so they
    // compose with extensions other packs register against this type.
    const registration: Registration = {
      selector: type,
      handleFor,
      handleForNode,
      active: true,
      apply: (builder) => {
        builder.setExecution(
          definition.execution ?? 'backend',
          definition.resolve
        )
        if (definition.onCreated) builder.onCreated(definition.onCreated)
        if (definition.onExecuted) builder.onExecuted(definition.onExecuted)
        if (definition.onConfigured) {
          builder.onConfigured(definition.onConfigured)
        }
        if (definition.onConnectionsChanged) {
          builder.onConnectionsChanged(definition.onConnectionsChanged)
        }
        if (definition.onPropertyChanged) {
          builder.onPropertyChanged(definition.onPropertyChanged)
        }
        if (definition.onDragOver) builder.onDragOver(definition.onDragOver)
        if (definition.onDrop) builder.onDrop(definition.onDrop)
        if (definition.onRemoved) builder.onRemoved(definition.onRemoved)
        if (definition.onSerialize) builder.onSerialize(definition.onSerialize)
        if (definition.onPromptSerialize) {
          builder.onPromptSerialize(definition.onPromptSerialize)
        }
        if (definition.supply) builder.setSupply(definition.supply)
      }
    }
    registrations.add(registration)

    registry.applyTo(Defined, raw)
    LiteGraph.registerNodeType(type, Defined)

    return () => {
      registration.active = false
      registrations.delete(registration)
      frontendResolvers.delete(type)
      frontendSuppliers.delete(type)
      promptInputProjectors.delete(type)
      previewSubscribers.delete(type)
      unplacedLinkSubscribers.delete(type)
      LiteGraph.unregisterNodeType(type)
      known.delete(type)
    }
  }

  const registry = {
    forMajor: (
      handleFor: (nodeId: string) => NodeHandle,
      handleForNode = (node: LGraphNode) => handleFor(String(node.id))
    ): DefRegistry => ({
      define: (definition: NodeDefinition) =>
        defineType(definition, handleFor, handleForNode),
      defineWidgetType: createWidgetTypeRegistrar(handleForNode),
      get: (type) => known.get(type),
      all: () => Object.freeze([...known.values()]),
      has: (type) => known.has(type),

      typeColor: (type) => packTypeColors.get(type) ?? getLinkTypeColor(type),

      nodeColor(name) {
        const entry = extensionValue(LGraphCanvas.node_colors[name])
        if (!entry) return undefined
        return Object.freeze({
          color: entry.color,
          bgColor: entry.bgcolor,
          groupColor: entry.groupcolor
        })
      },

      isTypeCompatible: (outputType, inputType) =>
        LiteGraph.isValidConnection(outputType, inputType),

      setTypeColor(type, color) {
        // Loading a palette seeds every backend-registered type to '' — so the
        // key existing is not the host claiming the colour. Only a non-empty
        // value is.
        if (LGraphCanvas.link_type_colors[type]) {
          throw new ComfyApiError(
            `The host already colours '${type}'. A pack may colour a type it ` +
              `introduces, not one it did not.`
          )
        }
        packTypeColors.set(type, color)
        applyPackTypeColors()
        return () => {
          packTypeColors.delete(type)
          delete LGraphCanvas.link_type_colors[type]
        }
      },

      refresh: async () => {
        if (!refreshDefinitions) {
          throw new ComfyApiError(
            'Definition refresh is not connected to the host.'
          )
        }
        await refreshDefinitions()
      },
      onRefreshed: onDefsRefreshed,

      extend(selector, apply) {
        assertSelector(selector)
        // Scoped to the types this selector actually names. `define()` installs
        // prototype behaviour before it returns, so extending a type already
        // applied would run every earlier hook twice — but a pack loaded after
        // some *other* pack called `define()` is not that case. As a global
        // latch this threw in the second pack's module body, so it registered
        // nothing at all: whichever pack happened to define first silently
        // disabled every extending pack behind it.
        const applied = [...known.values()].filter((def) =>
          matches(selector, def)
        )
        if (applied.length) {
          const names = applied.map((def) => `'${def.type}'`).join(', ')
          throw new ComfyApiError(
            `comfy.defs.extend() cannot extend ${names}: already registered. ` +
              `Register the extension before the definition.`
          )
        }
        const registration: Registration = {
          selector,
          apply,
          handleFor,
          handleForNode,
          active: true
        }
        registrations.add(registration)
        return () => {
          registration.active = false
          registrations.delete(registration)
        }
      }
    }),

    applyTo(nodeType: { prototype: Partial<LGraphNode> }, raw: unknown) {
      let def = toNodeDef(raw as RawNodeDef)
      const original = def
      known.set(def.type, def)

      type Bound<TArgs extends unknown[]> = {
        run: (node: NodeHandle, ...args: TArgs) => void
        handleFor: (nodeId: string) => NodeHandle
        handleForNode: (node: LGraphNode) => NodeHandle
        isActive: () => boolean
      }
      const created: Bound<[NodeCreatedEvent]>[] = []
      const executed: Bound<[ExecutionResult]>[] = []
      const configured: Bound<[Record<string, unknown>]>[] = []
      const propertyChanges: Bound<[PropertyChangeEvent]>[] = []
      const resized: Bound<[Size]>[] = []
      const hovered: Bound<[boolean]>[] = []
      const doubleClicked: Bound<[]>[] = []
      const dragOver: {
        run: (node: NodeHandle, event: DragEvent) => boolean | void
        handleFor: (nodeId: string) => NodeHandle
        handleForNode: (node: LGraphNode) => NodeHandle
        isActive: () => boolean
      }[] = []
      const dropped: {
        run: (
          node: NodeHandle,
          event: DragEvent
        ) => boolean | void | Promise<boolean | void>
        handleFor: (nodeId: string) => NodeHandle
        handleForNode: (node: LGraphNode) => NodeHandle
        isActive: () => boolean
      }[] = []
      const connections: Bound<[ConnectionChangeEvent]>[] = []
      const removed: Bound<[]>[] = []
      const previewed: Bound<[PreviewFrame]>[] = []
      const beforeConnect: {
        run: (node: NodeHandle, event: BeforeConnectEvent) => boolean | void
        handleFor: (nodeId: string) => NodeHandle
        handleForNode: (node: LGraphNode) => NodeHandle
        isActive: () => boolean
      }[] = []
      const unplacedLink: {
        run: (node: NodeHandle, event: UnplacedLinkEvent) => boolean | void
        handleFor: (nodeId: string) => NodeHandle
        handleForNode: (node: LGraphNode) => NodeHandle
        isActive: () => boolean
      }[] = []
      const executionState: {
        frontendOnly: boolean
        resolver?: Resolver
      } = {
        frontendOnly: false,
        resolver: undefined
      }
      const declaredSuppliers: Supplier[] = []
      const menuItems: {
        item: NodeMenuItem
        handleFor: (nodeId: string) => NodeHandle
        handleForNode: (node: LGraphNode) => NodeHandle
        isActive: () => boolean
      }[] = []
      const serialized: {
        run: (node: NodeHandle) => Record<string, unknown>
        handleFor: (nodeId: string) => NodeHandle
        handleForNode: (node: LGraphNode) => NodeHandle
        isActive: () => boolean
      }[] = []
      const promptSerialized: BoundPromptInputProjector[] = []
      const widgets: {
        def: WidgetDef
        handleFor: Registration['handleFor']
        handleForNode: Registration['handleForNode']
        isActive: () => boolean
      }[] = []
      const hidden: {
        name: string
        handleFor: Registration['handleFor']
        handleForNode: Registration['handleForNode']
        isActive: () => boolean
      }[] = []

      const invoke = <T>(hook: string, callback: () => T): T | undefined => {
        try {
          return callback()
        } catch (error) {
          reportError(error, {
            errorType: 'node_api_extension_callback_failure',
            tags: { node_type: def.type, hook }
          })
          return undefined
        }
      }

      const invokeAsync = async <T>(
        hook: string,
        callback: () => T | Promise<T>
      ): Promise<T | undefined> => {
        try {
          return await callback()
        } catch (error) {
          reportError(error, {
            errorType: 'node_api_extension_callback_failure',
            tags: { node_type: def.type, hook }
          })
          return undefined
        }
      }

      let applied = 0
      for (const registration of registrations) {
        if (!matches(registration.selector, def)) continue
        applied++
        const { handleFor, handleForNode } = registration
        const isActive = () => registration.active
        const binding = { handleFor, handleForNode, isActive }

        const builder: NodeDefBuilder = {
          get def() {
            return def
          },
          setTitle: (title) => {
            def = Object.freeze({ ...def, title })
          },
          setCategory: (category) => {
            def = Object.freeze({ ...def, category })
          },
          setExecution: (execution, resolve) => {
            executionState.frontendOnly = execution === 'frontend'
            if (resolve) {
              executionState.resolver = (view) =>
                isActive() ? resolve(view) : Object.freeze({})
            }
          },
          setSupply: (supply) => {
            declaredSuppliers.push((view) =>
              isActive() ? supply(view) : Object.freeze([])
            )
          },
          addWidget: (def) => widgets.push({ def, ...binding }),
          hideWidget: (name) => hidden.push({ name, ...binding }),
          onCreated: (run) => created.push({ run, ...binding }),
          onExecuted: (run) => executed.push({ run, ...binding }),
          onConfigured: (run) => configured.push({ run, ...binding }),
          onPropertyChanged: (run) => propertyChanges.push({ run, ...binding }),
          onResized: (run) => resized.push({ run, ...binding }),
          onHover: (run) => hovered.push({ run, ...binding }),
          onDoubleClick: (run) => doubleClicked.push({ run, ...binding }),
          onDragOver: (run) => dragOver.push({ run, ...binding }),
          onDrop: (run) => dropped.push({ run, ...binding }),
          onConnectionsChanged: (run) => connections.push({ run, ...binding }),
          onRemoved: (run) => removed.push({ run, ...binding }),
          onPreview: (run) => previewed.push({ run, ...binding }),
          onSerialize: (run) => serialized.push({ run, ...binding }),
          onPromptSerialize: (run) =>
            promptSerialized.push({ run, handleFor, isActive }),
          onBeforeConnect: (run) => beforeConnect.push({ run, ...binding }),
          onUnplacedLink: (run) => unplacedLink.push({ run, ...binding }),
          addMenuItem: (item) => menuItems.push({ item, ...binding })
        }

        try {
          registration.apply(builder)
        } catch (error) {
          // One pack's bad extension must not stop the others, or a single
          // broken conversion takes down every pack that touches this type.
          console.error(
            `[comfy.defs] extension failed for '${def.type}'`,
            error instanceof Error ? error.message : error
          )
          reportError(error, {
            errorType: 'node_api_def_extension_failure',
            tags: { node_type: def.type }
          })
        }
      }

      if (!applied) {
        frontendResolvers.delete(def.type)
        frontendSuppliers.delete(def.type)
        promptInputProjectors.delete(def.type)
        previewSubscribers.delete(def.type)
        unplacedLinkSubscribers.delete(def.type)
        return
      }
      known.set(def.type, def)

      // Write the definition back to the raw def, which is what the caller
      // actually registers from. `setTitle`/`setCategory` used to update only
      // the mirror above: the host builds its node class from `raw` *after*
      // this returns and assigns `node.title` from it, so a pack renaming a
      // type saw nothing happen. The legacy hook this replaces modifies the
      // same object in place, so doing likewise keeps one contract, not two.
      if (executionState.frontendOnly) {
        // The same flags `defs.define` sets for a pack-declared frontend
        // node. `graphToPrompt` skips it, which is the whole point; with a
        // resolver, execution-time link walking stops at the node and the
        // resolution pass substitutes.
        nodeType.prototype.isVirtualNode = true
        if (executionState.resolver) {
          frontendResolvers.set(def.type, executionState.resolver)
          nodeType.prototype.resolutionOwned = true
        } else {
          frontendResolvers.delete(def.type)
        }
      } else {
        frontendResolvers.delete(def.type)
      }

      // Outside the `frontendOnly` branch deliberately: broadcasting is about
      // what this node gives others, not about whether it executes.
      if (declaredSuppliers.length === 1) {
        frontendSuppliers.set(def.type, declaredSuppliers[0])
      } else if (declaredSuppliers.length > 1) {
        frontendSuppliers.set(def.type, (view) => {
          // Composition stays synchronous unless a part is asynchronous —
          // otherwise composing two ordinary suppliers would trip the
          // sync-path degradation neither of them deserves.
          const parts = declaredSuppliers.map((supplier) => supplier(view))
          return parts.some((p) => p instanceof Promise)
            ? Promise.all(parts).then((edges) => edges.flat())
            : parts.flatMap((p) => (p instanceof Promise ? [] : p))
        })
      } else {
        frontendSuppliers.delete(def.type)
      }

      if (promptSerialized.length) {
        promptInputProjectors.set(def.type, {
          allowed: new Set(def.inputs.map((input) => input.name)),
          projectors: Object.freeze([...promptSerialized])
        })
      } else {
        promptInputProjectors.delete(def.type)
      }

      const rawDef = raw as RawNodeDef
      if (def.title !== original.title) rawDef.display_name = def.title
      if (def.category !== original.category) rawDef.category = def.category

      // Callbacks compose: each is invoked in registration order, and none can
      // suppress another by forgetting to chain.
      const install = <TKey extends NodeCallbackKey>(
        key: TKey,
        run: (node: LGraphNode, ...args: NodeCallbackArgs<TKey>) => unknown,
        /**
         * A vetoing callback: litegraph reads `false` as "refuse", so the
         * chain must return a value and stop at the first refusal rather than
         * calling everything and discarding the answers.
         */
        options?: { veto: true }
      ) => {
        const previous = nodeType.prototype[key] as
          | ((this: LGraphNode, ...args: NodeCallbackArgs<TKey>) => unknown)
          | undefined
        // The previous value may be another pack's legacy prototype patch, so
        // it is still called through — composition here, chaining underneath.
        ;(nodeType.prototype as Record<string, unknown>)[key] = function (
          this: LGraphNode,
          ...args: NodeCallbackArgs<TKey>
        ) {
          const before = previous?.apply(this, args)
          if (options?.veto && before === false) return false
          const answer = run(this, ...args)
          return options?.veto ? answer !== false : undefined
        }
      }

      // Unconditional: `restored` is answered from whether configure ran, so
      // it must be recorded for every node of a type any pack extends, not
      // only those with an onConfigured listener.
      install('onConfigure', (node) => {
        restoredNodes.add(node)
      })

      if (created.length || widgets.length || hidden.length) {
        install('onAdded', (node) => {
          const id = String(node.id)
          for (const { def: widget, handleFor, isActive } of widgets) {
            if (isActive()) {
              invoke('addWidget', () => handleFor(id).widgets.add(widget))
            }
          }
          for (const { name, handleFor, isActive } of hidden) {
            if (!isActive()) continue
            const widget = handleFor(id).widgets.get(name)
            if (widget) invoke('hideWidget', () => widget.setHidden(true))
          }
          const loading = isLoadingGraph()
          const event: NodeCreatedEvent = Object.freeze({
            restored: loading || restoredNodes.has(node),
            loading
          })
          for (const { run, handleFor, isActive } of created) {
            if (isActive()) invoke('onCreated', () => run(handleFor(id), event))
          }
        })
      }

      if (executed.length) {
        install('onExecuted', (node, message) => {
          const result = toExecutionResult(message)
          const id = String(node.id)
          for (const { run, handleFor, isActive } of executed) {
            if (isActive()) {
              invoke('onExecuted', () => run(handleFor(id), result))
            }
          }
        })
      }

      if (configured.length) {
        install('onConfigure', (node, serialised) => {
          const data = (extensionValue(serialised) ?? {}) as unknown as Record<
            string,
            unknown
          >
          const id = String(node.id)
          for (const { run, handleFor, isActive } of configured) {
            if (isActive()) {
              invoke('onConfigured', () => run(handleFor(id), data))
            }
          }
        })
      }

      if (propertyChanges.length) {
        /** Runs every handler and reports the value they settled on. */
        const settle = (
          node: LGraphNode,
          name: string,
          value: unknown,
          previous: unknown
        ) => {
          let replacement = value
          const event: PropertyChangeEvent = Object.freeze({
            name,
            value,
            previous,
            setValue: (next: unknown) => {
              replacement = next
            },
            reject: () => {
              replacement = previous
            }
          })
          const id = String(node.id)
          for (const { run, handleFor, isActive } of propertyChanges) {
            if (isActive()) {
              invoke('onPropertyChanged', () => run(handleFor(id), event))
            }
          }
          return replacement
        }

        // Wrapping setProperty rather than only hooking onPropertyChanged:
        // setProperty writes `properties`, calls the callback, and *then*
        // syncs any widget bound to the property — from the value it was
        // passed, not the one the callback settled on. Nothing a callback does
        // can win against a write that happens after it returns, so the
        // replacement has to be in place before litegraph starts.
        const settling = new WeakSet<LGraphNode>()
        const previousSetProperty = nodeType.prototype.setProperty as (
          this: LGraphNode,
          name: string,
          value: unknown
        ) => void
        nodeType.prototype.setProperty = function (
          this: LGraphNode,
          name: string,
          value: unknown
        ) {
          if (settling.has(this)) {
            return previousSetProperty.call(this, name, value)
          }
          const replacement = settle(this, name, value, this.properties[name])
          settling.add(this)
          try {
            previousSetProperty.call(this, name, replacement)
          } finally {
            settling.delete(this)
          }
        }

        // The properties panel writes the record and calls the callback
        // directly, without going through setProperty. No widget sync follows
        // it, so writing the record here is enough.
        install(
          'onPropertyChanged',
          (node, name, value, previous) => {
            if (settling.has(node)) return
            const replacement = settle(node, name, value, previous)
            if (replacement !== value) {
              node.properties[name] = replacement as never
            }
          },
          { veto: true }
        )
      }

      if (resized.length) {
        install('onResize', (node, [width, height]) => {
          const id = String(node.id)
          const size: Size = Object.freeze({ width, height })
          for (const { run, handleFor, isActive } of resized) {
            if (isActive()) invoke('onResized', () => run(handleFor(id), size))
          }
        })
      }

      if (hovered.length) {
        const dispatchHover = (node: LGraphNode, hovering: boolean) => {
          const id = String(node.id)
          for (const { run, handleFor, isActive } of hovered) {
            if (isActive()) {
              invoke('onHover', () => run(handleFor(id), hovering))
            }
          }
        }
        install('onMouseEnter', (node) => dispatchHover(node, true))
        install('onMouseLeave', (node) => dispatchHover(node, false))
      }

      if (doubleClicked.length) {
        install('onDblClick', (node) => {
          const id = String(node.id)
          for (const { run, handleFor, isActive } of doubleClicked) {
            if (isActive()) invoke('onDoubleClick', () => run(handleFor(id)))
          }
        })
      }

      if (dragOver.length) {
        const previous = nodeType.prototype.onDragOver
        nodeType.prototype.onDragOver = function (event: DragEvent) {
          if (previous?.call(this, event) === true) return true
          const id = String(this.id)
          return dragOver.some(
            ({ run, handleFor, isActive }) =>
              isActive() &&
              invoke('onDragOver', () => run(handleFor(id), event)) === true
          )
        }
      }

      if (dropped.length) {
        const previous = nodeType.prototype.onDragDrop
        nodeType.prototype.onDragDrop = async function (event: DragEvent) {
          if ((await previous?.call(this, event)) === true) return true
          const id = String(this.id)
          for (const { run, handleFor, isActive } of dropped) {
            if (
              isActive() &&
              (await invokeAsync('onDrop', () => run(handleFor(id), event))) ===
                true
            ) {
              return true
            }
          }
          return false
        }
      }

      if (connections.length) {
        install('onConnectionsChange', (node, side, index, connected, link) => {
          const input = side === 1
          // The link names both ends; which one is the peer depends on
          // which end this node is.
          const peer = link
            ? input
              ? { id: link.origin_id, slot: link.origin_slot }
              : { id: link.target_id, slot: link.target_slot }
            : undefined
          const event: ConnectionChangeEvent = Object.freeze({
            // litegraph's slot-type enum: 1 = input, 2 = output.
            side: input ? 'input' : 'output',
            index,
            connected,
            peerNodeId: peer ? String(peer.id) : undefined,
            peerIndex: peer?.slot
          })
          const id = String(node.id)
          for (const { run, handleFor, isActive } of connections) {
            if (isActive()) {
              invoke('onConnectionsChanged', () => run(handleFor(id), event))
            }
          }
        })
      }

      if (serialized.length) {
        const previous = nodeType.prototype.onSerialize
        ;(nodeType.prototype as Record<string, unknown>).onSerialize =
          function (this: LGraphNode, o: Record<string, unknown>) {
            ;(previous as ((o: unknown) => void) | undefined)?.call(this, o)
            const id = String(this.id)
            for (const { run, handleFor, isActive } of serialized) {
              if (!isActive()) continue
              const extra = invoke('onSerialize', () => run(handleFor(id)))
              if (!extra) continue
              for (const [key, value] of Object.entries(extra)) {
                // Core fields stay ours. A pack rewriting `type` or
                // `widgets_values` changes what the workflow means, which is
                // the one thing this migration promises not to do.
                if (RESERVED_SERIAL_KEYS.has(key)) continue
                o[key] = value
              }
            }
          }
      }

      if (beforeConnect.length) {
        /**
         * Asks every listener, in registration order. Any refusal refuses the
         * connection: a veto is only useful if one pack cannot be overruled by
         * another's silence.
         */
        const mayConnect = (
          node: LGraphNode,
          event: BeforeConnectEvent
        ): boolean => {
          const id = String(node.id)
          for (const { run, handleFor, isActive } of beforeConnect) {
            if (
              isActive() &&
              invoke('onBeforeConnect', () => run(handleFor(id), event)) ===
                false
            ) {
              return false
            }
          }
          return true
        }
        const peerOf = (candidate: unknown, peerIndex: number | undefined) => {
          const peer = candidate as { id?: unknown; type?: string } | undefined
          return {
            peerNodeId: peer?.id === undefined ? undefined : String(peer.id),
            peerIndex,
            peerType: peer?.type
          }
        }

        install(
          'onConnectInput',
          (node, index, _type, _output, sourceNode, sourceIndex) =>
            mayConnect(
              node,
              Object.freeze({
                side: 'input',
                index,
                ...peerOf(sourceNode, sourceIndex)
              })
            ),
          { veto: true }
        )

        // The output side was declared from the start and never installed, so
        // `side` was typed 'input' | 'output' and was always 'input'. A node
        // that may only feed particular types — rgthree's relay reaching only
        // a repeater — could be wired to anything and would silently do
        // nothing.
        install(
          'onConnectOutput',
          (node, index, _type, _input, targetNode, targetIndex) =>
            mayConnect(
              node,
              Object.freeze({
                side: 'output',
                index,
                ...peerOf(targetNode, targetIndex)
              })
            ),
          { veto: true }
        )
      }

      if (menuItems.length) {
        const previous = nodeType.prototype.getExtraMenuOptions
        ;(nodeType.prototype as Record<string, unknown>).getExtraMenuOptions =
          function (this: LGraphNode, canvas: unknown, options: unknown[]) {
            ;(
              previous as ((c: unknown, o: unknown[]) => void) | undefined
            )?.call(this, canvas, options)
            const id = String(this.id)
            const ordered = [...menuItems].sort(
              (a, b) => (a.item.order ?? 0) - (b.item.order ?? 0)
            )
            for (const { item, handleFor, isActive } of ordered) {
              if (!isActive()) continue
              const handle = handleFor(id)
              if (
                item.when &&
                invoke('menuItem.when', () => item.when!(handle)) !== true
              ) {
                continue
              }
              const label = item.label
              const content =
                typeof label === 'function'
                  ? invoke('menuItem.label', () => label(handle))
                  : label
              if (content === undefined) continue

              // Resolved per open, so a submenu can reflect the node as it is
              // now rather than as it was when the pack registered.
              const menuItems = item.items
              const children =
                typeof menuItems === 'function'
                  ? invoke('menuItem.items', () => menuItems(handle))
                  : menuItems

              // An entry that opens an empty submenu is a dead end, so it is
              // dropped unless it also has its own action. This is what the
              // packs do by hand: `if (submenuItems.length)` before adding.
              if (item.items !== undefined && !children?.length && !item.run) {
                continue
              }

              if (children?.length) {
                // Static options rather than a callback-built submenu: the
                // Nodes 2.0 converter reads `submenu.options` directly, so
                // this is the one shape both renderers understand.
                options.push({
                  content,
                  has_submenu: true,
                  submenu: {
                    options: children.map((child) => ({
                      content: child.label,
                      callback: () =>
                        invoke('menuItem.run', () => child.run(handleFor(id)))
                    }))
                  }
                })
                continue
              }

              options.push({
                content,
                callback: () =>
                  invoke('menuItem.run', () => item.run?.(handleFor(id)))
              })
            }
          }
      }

      if (previewed.length) {
        previewSubscribers.set(def.type, (nodeId, frame) => {
          for (const { run, handleFor, isActive } of previewed) {
            if (!isActive()) continue
            // Subscribers are keyed by type alone, so the event can name a
            // node in another graph scope or one already removed. A pack
            // callback takes a handle, not the absence of one.
            const node = extensionValue(handleFor(nodeId))
            if (!node) continue
            invoke('onPreview', () => run(node, frame))
          }
        })
      } else {
        previewSubscribers.delete(def.type)
      }

      if (unplacedLink.length) {
        unplacedLinkSubscribers.set(def.type, (nodeId, event) => {
          // Stops at the first listener that claims the drop, so two packs
          // extending one type cannot both wire the same gesture.
          for (const { run, handleFor, isActive } of unplacedLink) {
            if (!isActive()) continue
            const node = extensionValue(handleFor(nodeId))
            if (!node) continue
            if (invoke('onUnplacedLink', () => run(node, event)) === true) {
              return true
            }
          }
          return false
        })
      } else {
        unplacedLinkSubscribers.delete(def.type)
      }

      if (removed.length) {
        install('onRemoved', (node) => {
          const id = String(node.id)
          for (const { run, handleFor, isActive } of removed) {
            if (isActive()) invoke('onRemoved', () => run(handleFor(id)))
          }
        })
      }
    }
  }

  return registry
}
