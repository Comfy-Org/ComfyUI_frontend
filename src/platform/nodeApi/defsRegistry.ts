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
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

import { ComfyApiError } from './errors'
import type { NodeHandle } from './nodeHandle'
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

export interface DefRegistry {
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

  return {
    forMajor: (handleFor) => ({
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

    applyTo(nodeType, raw) {
      let def = toNodeDef(raw as RawNodeDef)
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
          addWidget: (def) => widgets.push({ def, handleFor }),
          hideWidget: (name) => hidden.push({ name, handleFor }),
          onCreated: (run) => created.push({ run, handleFor }),
          onExecuted: (run) => executed.push({ run, handleFor }),
          onConfigured: (run) => configured.push({ run, handleFor }),
          onConnectionsChanged: (run) => connections.push({ run, handleFor }),
          onRemoved: (run) => removed.push({ run, handleFor }),
          onPreview: (run) => previewed.push({ run, handleFor })
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
}
