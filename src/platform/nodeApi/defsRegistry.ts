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

  onCreated?(node: NodeHandle): void
  onExecuted?(node: NodeHandle, result: ExecutionResult): void
  onConfigured?(node: NodeHandle, data: Record<string, unknown>): void
  onConnectionsChanged?(node: NodeHandle, event: ConnectionChangeEvent): void
  onRemoved?(node: NodeHandle): void
  onSerialize?(node: NodeHandle): Record<string, unknown>
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
}

interface Registration {
  readonly selector: DefSelector
  readonly apply: (builder: NodeDefBuilder) => void
  /**
   * Bound at registration, not at the registry, because one registry is shared
   * by every major: a v1 pack's callback must receive v1 handles even though a
   * v2 pack extended the same type.
   */
  readonly handleFor: (nodeId: string) => NodeHandle
}

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
      selector !== null &&
      'category' in selector)
  if (valid) return
  throw new ComfyApiError(
    `Unrecognised def selector: ${JSON.stringify(selector) ?? String(selector)}. ` +
      `Expected a type name, an array of type names, a RegExp, or ` +
      `{ category: string | RegExp }.`
  )
}

function matches(selector: DefSelector, def: NodeDef): boolean {
  if (typeof selector === 'function') return selector(def)
  if (typeof selector === 'string') return def.type === selector
  if (selector instanceof RegExp) return selector.test(def.type)
  // `Array.isArray` does not narrow a `readonly` array out of a union.
  if ('length' in selector) return selector.includes(def.type)
  const { category } = selector
  return category instanceof RegExp
    ? category.test(def.category)
    : def.category === category
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
  }
}

function toNodeDef(raw: RawNodeDef): NodeDef {
  const slotType = (spec: unknown) => {
    const first = Array.isArray(spec) ? spec[0] : undefined
    return Array.isArray(first) ? 'COMBO' : String(first ?? '*')
  }

  const inputs = Object.entries({
    ...(raw.input?.required ?? {}),
    ...(raw.input?.optional ?? {})
  }).map(([name, spec]) => Object.freeze({ name, type: slotType(spec) }))

  const outputs = (raw.output ?? []).map((type, index) =>
    Object.freeze({
      name: raw.output_name?.[index] ?? String(type),
      type: String(type)
    })
  )

  return Object.freeze({
    type: raw.name ?? '',
    title: raw.display_name ?? raw.name ?? '',
    category: raw.category ?? '',
    description: raw.description ?? '',
    inputs: Object.freeze(inputs),
    outputs: Object.freeze(outputs),
    isOutputNode: raw.output_node ?? false,
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

/** The resolvers currently registered, for `resolveFrontendNodes`. */
export function frontendResolverMap(): ReadonlyMap<string, Resolver> {
  return frontendResolvers
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

export function createDefRegistry(): {
  /** The per-major public face. Handles come from that major's graph. */
  forMajor(handleFor: (nodeId: string) => NodeHandle): DefRegistry
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
  const registerWidgetType = createWidgetTypeRegistrar()

  const defineType = (
    definition: NodeDefinition,
    handleFor: (nodeId: string) => NodeHandle
  ): Unsubscribe => {
    const { type } = definition
    if (LiteGraph.registered_node_types[type]) {
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
        for (const input of definition.inputs ?? []) {
          this.addInput(input.name, input.type)
        }
        for (const output of definition.outputs ?? []) {
          this.addOutput(output.name, output.type)
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
    }

    // Hooks route through the same registration path as extend(), so they
    // compose with extensions other packs register against this type.
    const registration: Registration = {
      selector: type,
      handleFor,
      apply: (builder) => {
        for (const widget of definition.widgets ?? []) builder.addWidget(widget)
        if (definition.onCreated) builder.onCreated(definition.onCreated)
        if (definition.onExecuted) builder.onExecuted(definition.onExecuted)
        if (definition.onConfigured) {
          builder.onConfigured(definition.onConfigured)
        }
        if (definition.onConnectionsChanged) {
          builder.onConnectionsChanged(definition.onConnectionsChanged)
        }
        if (definition.onRemoved) builder.onRemoved(definition.onRemoved)
        if (definition.onSerialize) builder.onSerialize(definition.onSerialize)
      }
    }
    registrations.add(registration)
    if (definition.resolve) frontendResolvers.set(type, definition.resolve)

    registry.applyTo(Defined, raw)
    LiteGraph.registerNodeType(type, Defined)

    return () => {
      registrations.delete(registration)
      frontendResolvers.delete(type)
      LiteGraph.unregisterNodeType(type)
      known.delete(type)
    }
  }

  const registry = {
    forMajor: (handleFor: (nodeId: string) => NodeHandle): DefRegistry => ({
      define: (definition: NodeDefinition) => defineType(definition, handleFor),
      defineWidgetType: registerWidgetType,
      get: (type) => known.get(type),
      all: () => Object.freeze([...known.values()]),
      has: (type) => known.has(type),

      extend(selector, apply) {
        assertSelector(selector)
        const registration: Registration = { selector, apply, handleFor }
        registrations.add(registration)
        return () => registrations.delete(registration)
      }
    }),

    applyTo(nodeType: { prototype: Partial<LGraphNode> }, raw: unknown) {
      let def = toNodeDef(raw as RawNodeDef)
      const original = def
      known.set(def.type, def)

      type Bound<TArgs extends unknown[]> = {
        run: (node: NodeHandle, ...args: TArgs) => void
        handleFor: (nodeId: string) => NodeHandle
      }
      const created: Bound<[]>[] = []
      const executed: Bound<[ExecutionResult]>[] = []
      const configured: Bound<[Record<string, unknown>]>[] = []
      const connections: Bound<[ConnectionChangeEvent]>[] = []
      const removed: Bound<[]>[] = []
      const previewed: Bound<[PreviewFrame]>[] = []
      const beforeConnect: {
        run: (node: NodeHandle, event: BeforeConnectEvent) => boolean | void
        handleFor: (nodeId: string) => NodeHandle
      }[] = []
      let frontendOnly = false
      let declaredResolver: Resolver | undefined
      const menuItems: {
        item: NodeMenuItem
        handleFor: (nodeId: string) => NodeHandle
      }[] = []
      const serialized: {
        run: (node: NodeHandle) => Record<string, unknown>
        handleFor: (nodeId: string) => NodeHandle
      }[] = []
      const widgets: {
        def: WidgetDef
        handleFor: Registration['handleFor']
      }[] = []
      const hidden: { name: string; handleFor: Registration['handleFor'] }[] =
        []

      let applied = 0
      for (const registration of registrations) {
        if (!matches(registration.selector, def)) continue
        applied++
        const { handleFor } = registration

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
            frontendOnly = execution === 'frontend'
            if (resolve) declaredResolver = resolve
          },
          addWidget: (def) => widgets.push({ def, handleFor }),
          hideWidget: (name) => hidden.push({ name, handleFor }),
          onCreated: (run) => created.push({ run, handleFor }),
          onExecuted: (run) => executed.push({ run, handleFor }),
          onConfigured: (run) => configured.push({ run, handleFor }),
          onConnectionsChanged: (run) => connections.push({ run, handleFor }),
          onRemoved: (run) => removed.push({ run, handleFor }),
          onPreview: (run) => previewed.push({ run, handleFor }),
          onSerialize: (run) => serialized.push({ run, handleFor }),
          onBeforeConnect: (run) => beforeConnect.push({ run, handleFor }),
          addMenuItem: (item) => menuItems.push({ item, handleFor })
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
        }
      }

      if (!applied) return
      known.set(def.type, def)

      // Write the definition back to the raw def, which is what the caller
      // actually registers from. `setTitle`/`setCategory` used to update only
      // the mirror above: the host builds its node class from `raw` *after*
      // this returns and assigns `node.title` from it, so a pack renaming a
      // type saw nothing happen. The legacy hook this replaces modifies the
      // same object in place, so doing likewise keeps one contract, not two.
      if (frontendOnly) {
        // The same flag `defs.define` sets for a pack-declared frontend node.
        // `graphToPrompt` skips it, which is the whole point.
        ;(nodeType.prototype as Partial<LGraphNode>).isVirtualNode = true
        if (declaredResolver) frontendResolvers.set(def.type, declaredResolver)
      }

      const rawDef = raw as RawNodeDef
      if (def.title !== original.title) rawDef.display_name = def.title
      if (def.category !== original.category) rawDef.category = def.category

      // Callbacks compose: each is invoked in registration order, and none can
      // suppress another by forgetting to chain.
      const install = <TArgs extends unknown[]>(
        key:
          | 'onAdded'
          | 'onExecuted'
          | 'onConfigure'
          | 'onConnectionsChange'
          | 'onRemoved',
        run: (node: LGraphNode, ...args: TArgs) => void
      ) => {
        const previous = nodeType.prototype[key] as
          | ((this: LGraphNode, ...args: TArgs) => void)
          | undefined
        // The previous value may be another pack's legacy prototype patch, so
        // it is still called through — composition here, chaining underneath.
        ;(nodeType.prototype as Record<string, unknown>)[key] = function (
          this: LGraphNode,
          ...args: TArgs
        ) {
          previous?.apply(this, args)
          run(this, ...args)
        }
      }

      if (created.length || widgets.length || hidden.length) {
        install('onAdded', (node) => {
          const id = String(node.id)
          for (const { def: widget, handleFor } of widgets) {
            handleFor(id).widgets.add(widget)
          }
          for (const { name, handleFor } of hidden) {
            const widget = handleFor(id).widgets.get(name)
            if (widget) widget.setHidden(true)
          }
          for (const { run, handleFor } of created) run(handleFor(id))
        })
      }

      if (executed.length) {
        install<[unknown]>('onExecuted', (node, message) => {
          const result = toExecutionResult(message)
          const id = String(node.id)
          for (const { run, handleFor } of executed) run(handleFor(id), result)
        })
      }

      if (configured.length) {
        install<[ISerialisedNode]>('onConfigure', (node, serialised) => {
          const data = (serialised ?? {}) as unknown as Record<string, unknown>
          const id = String(node.id)
          for (const { run, handleFor } of configured) run(handleFor(id), data)
        })
      }

      if (connections.length) {
        install<[number, number, boolean]>(
          'onConnectionsChange',
          (node, side, index, connected) => {
            const event: ConnectionChangeEvent = Object.freeze({
              // litegraph's slot-type enum: 1 = input, 2 = output.
              side: side === 1 ? 'input' : 'output',
              index,
              connected: Boolean(connected)
            })
            const id = String(node.id)
            for (const { run, handleFor } of connections) {
              run(handleFor(id), event)
            }
          }
        )
      }

      if (serialized.length) {
        const previous = nodeType.prototype.onSerialize
        ;(nodeType.prototype as Record<string, unknown>).onSerialize =
          function (this: LGraphNode, o: Record<string, unknown>) {
            ;(previous as ((o: unknown) => void) | undefined)?.call(this, o)
            const id = String(this.id)
            for (const { run, handleFor } of serialized) {
              for (const [key, value] of Object.entries(run(handleFor(id)))) {
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
        const previous = nodeType.prototype.onConnectInput
        ;(nodeType.prototype as Record<string, unknown>).onConnectInput =
          function (
            this: LGraphNode,
            index: number,
            type: unknown,
            output: unknown,
            sourceNode: unknown
          ) {
            const allowed = (
              previous as ((...a: unknown[]) => unknown) | undefined
            )?.call(this, index, type, output, sourceNode)
            if (allowed === false) return false
            const peer = sourceNode as
              | { id?: unknown; type?: string }
              | undefined
            const event: BeforeConnectEvent = Object.freeze({
              side: 'input',
              index,
              peerNodeId: peer?.id === undefined ? undefined : String(peer.id),
              peerType: peer?.type
            })
            const id = String(this.id)
            // Any listener refusing refuses the connection: a veto is only
            // useful if one pack cannot be overruled by another's silence.
            for (const { run, handleFor } of beforeConnect) {
              if (run(handleFor(id), event) === false) return false
            }
            return true
          }
      }

      if (menuItems.length) {
        const previous = nodeType.prototype.getExtraMenuOptions
        ;(nodeType.prototype as Record<string, unknown>).getExtraMenuOptions =
          function (this: LGraphNode, canvas: unknown, options: unknown[]) {
            ;(
              previous as ((c: unknown, o: unknown[]) => void) | undefined
            )?.call(this, canvas, options)
            const id = String(this.id)
            for (const { item, handleFor } of menuItems) {
              options.push({
                content: item.label,
                callback: () => item.run(handleFor(id))
              })
            }
          }
      }

      if (previewed.length) {
        previewSubscribers.set(def.type, (nodeId, frame) => {
          for (const { run, handleFor } of previewed)
            run(handleFor(nodeId), frame)
        })
      }

      if (removed.length) {
        install('onRemoved', (node) => {
          const id = String(node.id)
          for (const { run, handleFor } of removed) run(handleFor(id))
        })
      }
    }
  }

  return registry
}
