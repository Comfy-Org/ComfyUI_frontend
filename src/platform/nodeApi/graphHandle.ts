/**
 * `GraphHandle` — the root of the public graph surface, and the place where the
 * per-node collections are composed and cached.
 *
 * This is the only module that knows how the pieces fit together; everything
 * below it is independently testable.
 */
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { toNodeId } from '@/types/nodeId'

import { ComfyApiError } from './errors'
import { createGroupHandles } from './groupHandle'
import type { GroupHandle } from './groupHandle'
import type { Point, NodeHandle } from './nodeHandle'
import { createNodeHandles } from './nodeHandle'
import { resolveFrontendNodes, resolveSupplies } from './resolution'
import type { ResolvedSupply, Resolver, Supplier } from './resolution'
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
   * The supply edges prompt execution would use in this graph right now.
   *
   * Re-runs the registered pure suppliers and the host's priority arbitration,
   * returning graph-local ids suitable for {@link OutputSlotHandle.connectTo}.
   * Exact priority ties are absent, just as they are from the prompt. The
   * frozen snapshot never mutates the graph.
   */
  resolvedSupplies(): readonly ResolvedSupply[]
  /**
   * The nodes the user currently has selected.
   *
   * 15 packs read `canvas.selected_nodes` or `selectedItems` for this — a
   * canvas internal, and the canvas is exactly what Nodes 2.0 replaces.
   * Selection is a property of the document, so it is asked of the graph.
   */
  selection(): readonly NodeHandle[]
  /**
   * Replaces the selection with these nodes. An empty list clears it.
   *
   * A node a pack just created is the usual case — `LGraphCanvas.add`'s
   * `options.select` put it straight under the user's cursor, and without this
   * the node appears but the user has to find and click it.
   *
   * `add: true` extends the selection instead of replacing it.
   */
  select(nodes: readonly NodeHandle[], options?: { add?: boolean }): void
  /**
   * Pans the view so a node sits in the middle of it.
   *
   * Packs wrote `canvas.ds.offset` themselves to do this, which bakes in the
   * renderer's transform and the device pixel ratio. Does not change zoom.
   */
  centerOn(node: NodeHandle): void
  /**
   * The groups on the canvas, in draw order.
   *
   * Packs read `graph._groups` to build a group muter, a group runner, or a
   * navigator. A group is a rectangle plus a title: which nodes it holds is
   * derived from what it overlaps, which is why `nodes()` is a method and not
   * a stored list.
   */
  groups(): readonly GroupHandle[]
  /**
   * Scales the view. 1 is unzoomed.
   *
   * Packs saved a zoom level alongside a node to restore a view; without this
   * a bookmark could pan but the number it stored was inert. Clamped to what
   * the canvas allows, so a stored extreme cannot strand the user.
   */
  setZoom(scale: number): void
  /**
   * Where the pointer is, in graph space — the coordinates {@link nodeAt} and
   * {@link NodeHandle.setPosition} use.
   *
   * A pack adding a node from a menu put it under the cursor. Without this the
   * node lands at the graph origin, which on any panned view is off screen.
   *
   * `undefined` when there is no canvas to measure against.
   */
  pointerPosition(): Point | undefined
  /**
   * The document's root graph, even while the user is viewing a subgraph.
   * Undefined before a document exists.
   */
  root(): GraphScopeHandle | undefined
  /**
   * The subgraph definitions in the document, each scoped to its own nodes.
   *
   * `nodes()` and `node()` address the graph on screen only, so a pack that
   * must reach every node — refreshing its own nodes after a run, walking a
   * chain — misses anything nested.
   *
   * Access is *through* the subgraph rather than a flattened list. Ids are
   * allocated from the root graph's counter, so they do not collide among
   * nodes created in one session — but a subgraph loaded from a file brings
   * its authored ids, and `configure` raises that counter without renumbering
   * anything. Two independently authored subgraphs can therefore carry the
   * same id. Resolving inside the owning graph is correct either way, and does
   * not rest on an invariant litegraph does not promise.
   *
   * These are definitions, not instances. A subgraph placed three times has
   * one entry, and its nodes appear once — which is what a pack acting on
   * "each of my nodes" wants.
   */
  subgraphs(): readonly GraphScopeHandle[]
  /**
   * Runs several mutations as one undo step.
   *
   * Without it, a pack that adds three nodes and wires them leaves the user
   * pressing undo four times to get back. `graph.beforeChange()` /
   * `afterChange()` did this by counting nesting depth.
   *
   * A scope rather than a pair of calls: the counter only captures when it
   * returns to zero, so one throw between a manual `before` and `after` stops
   * undo capturing anything at all, for the rest of the session, with nothing
   * to show why. The scope closes on the way out either way.
   *
   * Synchronous on purpose. Holding the group open across an `await` would
   * fold whatever the user did while waiting into the pack's undo step.
   */
  batch<T>(mutations: () => T): T
  /**
   * The topmost node at a point in graph space, if any.
   *
   * Packs building a gesture were walking every node and re-deriving its
   * rectangle from renderer constants. The graph already knows, and its answer
   * respects z-order, collapsed nodes and the active renderer's layout.
   *
   * Answers against the *rendered* layout, which is the only sensible reading
   * of "what is under this point" — and is why it is not refreshed per call: a
   * gesture asks this on every pointer move, and remeasuring every node each
   * time would be the expensive mistake. Before the first frame it finds
   * nothing.
   */
  nodeAt(point: { x: number; y: number }): NodeHandle | undefined
  /**
   * A copy of a node, carrying its widget values and properties, added to the
   * graph without links.
   *
   * `add(type)` only makes a fresh node of a type, so a pack duplicating a
   * configured node — a prompt box the user has filled in — had no way to keep
   * what it contained. Links are deliberately not copied: a duplicate wired
   * into the same places is a different operation, and the caller can connect
   * it themselves.
   *
   * `undefined` if the node is gone, or if its type is not registered — the
   * copy is built through the registry, so there is nothing to build from.
   * Widget values carry over only for a type that serializes them, which every
   * backend-registered type does.
   */
  duplicate(
    id: string,
    position?: { x: number; y: number }
  ): NodeHandle | undefined
  /**
   * Rebuilds a node, optionally as another type, keeping what the user set and
   * every link that still fits. Replacing with the same type repairs a node
   * whose registered definition changed without discarding its state.
   * `undefined` if the node is gone; throws if the type is not registered.
   *
   * This is a real feature four packs ship — "Convert to Context Big", "Swap to
   * KSampler (Efficient)" — and all four hand-rolled it out of `graph.links`,
   * `getNodeById` and `LiteGraph.createNode`, which is most of what this
   * migration exists to delete. All four also got it wrong: one drops every
   * widget value and hardcodes "slot 0 only", the other recurses through
   * requestAnimationFrame forever on an inverted comparison and leaves a
   * separate undo step for the add, each connection, and the remove.
   *
   * Position, custom title, colour, mode, declared properties and widget values
   * carry over by name. Size is the larger of what the user set and what the new
   * type needs, so a node that grew more slots is not clipped. Links are re-made
   * by slot name, falling back to the same index; type checking is the ordinary
   * connection rule, so a link that no longer fits is dropped and warned about
   * rather than forced. The whole swap is one undo step.
   */
  replace(id: string, type: string): NodeHandle | undefined
  /**
   * Changes when the graph does: nodes added, removed or reconfigured, links
   * connected or disconnected, slots and subgraph inputs/outputs altered, and
   * the node flags a reader can see — collapsed, pinned, advanced.
   *
   * Hold one and compare it later to learn whether anything moved since. That
   * is the whole contract: an opaque token, not a count. Do not subtract two
   * of them, do not expect it to start anywhere in particular, and do not
   * expect consecutive changes to differ by one. Coalesced edits are free to
   * advance it once, and `batch()` exists precisely so they can.
   *
   * A widget value committed by the user or through
   * `WidgetHandle.setValue()` advances it through the same host protocol. Data
   * a pack keeps outside graph and widget state does not; a canvas widget
   * holding such data has `redraw()`.
   */
  readonly version: number
  /** Diagnostics: live handle-cache slots across all kinds. */
  readonly cacheSize: number
}

/**
 * Weakly caches one value per node id. Collections are cheap to rebuild but
 * must be identity-stable, since packs compare and store them.
 */
function weakCache<T extends object>(make: (nodeId: string) => T) {
  const cache = new Map<string, WeakRef<T>>()
  const finalizer = new FinalizationRegistry<string>((id) => {
    if (cache.get(id)?.deref() === undefined) cache.delete(id)
  })
  return (nodeId: string): T => {
    const existing = cache.get(nodeId)?.deref()
    if (existing) return existing
    const value = make(nodeId)
    cache.set(nodeId, new WeakRef(value))
    finalizer.register(value, nodeId)
    return value
  }
}

export function createGraphApi(
  getGraph: () => LGraph | null | undefined,
  /** API major, so handle caches never mix shapes across majors. */
  namespace = '',
  getResolvers: () => ReadonlyMap<string, Resolver> = () => new Map(),
  getSuppliers: () => ReadonlyMap<string, Supplier> = () => new Map()
): GraphHandle {
  const nodeById = (nodeId: string) =>
    getGraph()?.getNodeById(toNodeId(nodeId)) ?? undefined

  const widgetHandles = createWidgetHandles(getGraph, namespace)

  const inputsFor = weakCache<SlotCollection<InputSlotHandle>>((nodeId) =>
    createInputCollection(getGraph, () => nodeById(nodeId), getResolvers)
  )
  const outputsFor = weakCache<SlotCollection<OutputSlotHandle>>((nodeId) =>
    createOutputCollection(getGraph, () => nodeById(nodeId))
  )
  const widgetsFor = weakCache<WidgetCollection>((nodeId) =>
    createWidgetCollection(() => nodeById(nodeId), widgetHandles, nodeId)
  )

  const nodeHandles = createNodeHandles(
    getGraph,
    { inputs: inputsFor, outputs: outputsFor, widgets: widgetsFor },
    namespace
  )

  const handleFor = (nodeId: string) =>
    nodeHandles.handleFor(nodeId) as NodeHandle

  const groupHandle = createGroupHandles(handleFor)
  const graphScopeHandle = createGraphScopeHandles(getResolvers, getSuppliers)

  const requireGraph = (action: string): LGraph => {
    const graph = getGraph()
    if (!graph) {
      throw new ComfyApiError(
        `Cannot ${action}: no graph is active. Wait for setup() before touching the graph.`
      )
    }
    return graph
  }

  const api: GraphHandle = {
    get id() {
      return getGraph()?.id ?? ''
    },

    node: (id) => nodeHandles.liveHandleFor(id) as NodeHandle | undefined,

    nodes: () =>
      Object.freeze(
        (getGraph()?.nodes ?? []).map((n) => handleFor(String(n.id)))
      ),

    nodesOfType: (type) =>
      Object.freeze(
        (getGraph()?.nodes ?? [])
          .filter((n) => n.type === type)
          .map((n) => handleFor(String(n.id)))
      ),

    add(type, init) {
      const graph = requireGraph(`add node '${type}'`)
      // Through the registry, not `new LGraphNode`: inputs, outputs, widgets
      // and the prototype all come from the registered class, so constructing
      // directly yields a shell that reads as a node with no slots.
      const node = LiteGraph.createNode(type, init?.title)
      if (!node) {
        throw new ComfyApiError(
          `Cannot add '${type}': no such node type is registered.`
        )
      }
      graph.add(node)
      if (init?.position) node.pos = [init.position.x, init.position.y]
      return handleFor(String(node.id))
    },

    duplicate(id, position) {
      const graph = getGraph()
      const source = nodeById(id)
      if (!graph || !source) return undefined
      const copy = source.clone()
      if (!copy) return undefined
      graph.add(copy)
      if (position) copy.pos = [position.x, position.y]
      return handleFor(String(copy.id))
    },

    replace(id, type) {
      const graph = getGraph()
      const old = nodeById(id)
      if (!graph || !old) return undefined
      const replacement = LiteGraph.createNode(type)
      if (!replacement) {
        throw new ComfyApiError(
          `Cannot replace with '${type}': no such node type is registered.`
        )
      }

      // Everything is read before the old node leaves the graph: removing it
      // clears its links, and its size is wanted for the max below.
      const sources = old.inputs.map((input, index) => {
        const link = input.link == null ? undefined : graph.getLink(input.link)
        const origin = link && graph.getNodeById(link.origin_id)
        return origin
          ? { name: input.name, index, origin, originSlot: link.origin_slot }
          : undefined
      })
      const targets = old.outputs.flatMap((output, index) =>
        outputLinks(graph, old.id, index).flatMap((link) => {
          const target = graph.getNodeById(link.target_id)
          return target
            ? [
                {
                  name: output.name,
                  index,
                  target,
                  targetSlot: link.target_slot
                }
              ]
            : []
        })
      )
      const wanted = old.size
      const values = new Map(old.widgets?.map((w) => [w.name, w.value]))

      return this.batch(() => {
        graph.add(replacement)
        replacement.pos = [...old.pos]
        // Only a title the user actually changed. Carrying the old *type's*
        // default would leave a Context Big node captioned "Context".
        const isDefaultTitle =
          old.title === (old.constructor as { title?: string }).title
        if (!isDefaultTitle) replacement.title = old.title
        replacement.mode = old.mode
        if (old.color !== undefined) replacement.color = old.color
        if (old.bgcolor !== undefined) replacement.bgcolor = old.bgcolor
        for (const key of Object.keys(replacement.properties)) {
          if (key in old.properties) {
            replacement.properties[key] = old.properties[key]
          }
        }
        for (const widget of replacement.widgets ?? []) {
          if (values.has(widget.name)) widget.value = values.get(widget.name)
        }
        const needed = replacement.computeSize()
        replacement.size = [
          Math.max(wanted[0], needed[0]),
          Math.max(wanted[1], needed[1])
        ]

        graph.remove(old)

        const dropped: string[] = []
        // By name where the new type has one, else the same index. Name is the
        // stabler match — a type that grew a slot in the middle keeps its
        // wiring — and the index is what a renamed slot still has in common.
        const slotOn = (node: LGraphNode, name: string, index: number) =>
          node.findInputSlot(name) !== -1 || node.findOutputSlot(name) !== -1
            ? name
            : index
        for (const source of sources) {
          if (!source) continue
          const made = source.origin.connect(
            source.originSlot,
            replacement,
            slotOn(replacement, source.name, source.index)
          )
          if (!made) dropped.push(`input '${source.name}'`)
        }
        for (const target of targets) {
          const made = replacement.connect(
            slotOn(replacement, target.name, target.index),
            target.target,
            target.targetSlot
          )
          if (!made) dropped.push(`output '${target.name}'`)
        }
        if (dropped.length) {
          console.warn(
            `[comfy] Replacing node ${id} with '${type}' dropped ` +
              `${dropped.length} link(s): ${dropped.join(', ')}. The new type ` +
              `has no compatible slot for them.`
          )
        }
        return handleFor(String(replacement.id))
      })
    },

    nodeAt(point) {
      const node = getGraph()?.getNodeOnPos(point.x, point.y)
      return node ? handleFor(String(node.id)) : undefined
    },

    remove(id) {
      const graph = getGraph()
      const node = nodeById(id)
      if (!graph || !node) return false
      graph.remove(node)
      return true
    },

    select(nodes, { add = false } = {}) {
      const canvas = LGraphCanvas.active_canvas
      if (!canvas) return
      const graph = getGraph()
      const resolved = nodes
        .map((node) => graph?.getNodeById(toNodeId(node.id)))
        .filter((node) => !!node)
      if (!add) canvas.deselectAll()
      if (resolved.length) canvas.selectNodes(resolved, add)
    },

    groups() {
      const groups = getGraph()?._groups ?? []
      return Object.freeze(groups.map(groupHandle))
    },

    batch(mutations) {
      const graph = getGraph()
      graph?.beforeChange()
      try {
        return mutations()
      } finally {
        graph?.afterChange()
      }
    },

    subgraphs() {
      const graph = getGraph()
      const definitions = graph?.rootGraph?.subgraphs
      if (!definitions) return Object.freeze([])
      return Object.freeze(
        [...definitions.values()].map((subgraph) => graphScopeHandle(subgraph))
      )
    },

    root() {
      const root = getGraph()?.rootGraph
      return root ? graphScopeHandle(root) : undefined
    },

    pointerPosition() {
      const canvas = LGraphCanvas.active_canvas
      if (!canvas) return undefined
      const [x, y] = canvas.graph_mouse
      return Object.freeze({ x, y })
    },

    setZoom(scale) {
      const canvas = LGraphCanvas.active_canvas
      if (!canvas) return
      const element = canvas.canvas
      // Around the middle of the viewport: zooming about the origin throws the
      // graph off screen at anything but the default pan.
      canvas.setZoom(scale, [element.width / 2, element.height / 2])
    },

    centerOn(node) {
      const target = getGraph()?.getNodeById(toNodeId(node.id))
      if (target) LGraphCanvas.active_canvas?.centerOnNode(target)
    },

    selection() {
      const graph = getGraph()
      if (!graph) return Object.freeze([])
      // Read from the canvas while selection still lives there; the shape
      // stays correct when it moves into a store.
      const canvas = (
        graph as unknown as {
          list_of_graphcanvas?: { selected_nodes?: Record<string, unknown> }[]
        }
      ).list_of_graphcanvas?.[0]
      return Object.freeze(
        Object.keys(canvas?.selected_nodes ?? {})
          .map((id) => handleFor(id))
          .filter((n): n is NodeHandle => Boolean(n))
      )
    },

    links() {
      const graph = getGraph()
      if (!graph) return Object.freeze([])

      // Store-backed, via the sanctioned slotLinks helpers — never the
      // internal `graph._links` map, and floating links are excluded.
      const infos = (graph.nodes ?? []).flatMap((node) =>
        (node.outputs ?? []).flatMap((_, slot) =>
          outputLinks(graph, node.id, slot)
            .map((link) => toLinkInfo(graph, link))
            .filter((info): info is LinkInfo => info !== undefined)
        )
      )
      return Object.freeze(infos)
    },

    resolvedSupplies() {
      const graph = getGraph()
      if (!graph) return Object.freeze([])
      return resolveSupplies(
        graph,
        getSuppliers(),
        resolveFrontendNodes(graph, getResolvers())
      )
    },

    get version() {
      return getGraph()?._version ?? 0
    },

    get cacheSize() {
      return nodeHandles.cacheSize + widgetHandles.cacheSize
    }
  }

  return Object.freeze(api)
}

/**
 * A subgraph definition, scoped to its own contents.
 *
 * Deliberately narrower than {@link GraphHandle}: adding, selecting, centring
 * and zooming all address what the user is looking at, and a subgraph
 * definition is not that. This is for reading and reaching nodes.
 */
/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface GraphScopeHandle {
  /** Stable across every instance of this subgraph. */
  readonly id: string
  readonly name: string | undefined
  nodes(): readonly NodeHandle[]
  node(nodeId: string): NodeHandle | undefined
  /**
   * The groups drawn inside this subgraph.
   *
   * A group muter or runner that skipped these reported nothing for a
   * subgraph's contents while appearing to work.
   */
  groups(): readonly GroupHandle[]
  /** The supply edges prompt execution would use inside this graph. */
  resolvedSupplies(): readonly ResolvedSupply[]
}

/**
 * Each subgraph gets its own handle namespace, so a node's id is only ever
 * resolved against the graph it belongs to — and one cache cannot return a
 * handle for the wrong graph's node of the same id.
 */
function createGraphScopeHandles(
  getResolvers: () => ReadonlyMap<string, Resolver>,
  getSuppliers: () => ReadonlyMap<string, Supplier>
) {
  const byGraph = new WeakMap<LGraph, GraphScopeHandle>()

  return function graphScopeHandle(graph: LGraph): GraphScopeHandle {
    const id = String(graph.id)
    const existing = byGraph.get(graph)
    if (existing) return existing

    const scoped = createGraphApi(
      () => graph,
      `graph:${id}`,
      getResolvers,
      getSuppliers
    )
    const handle: GraphScopeHandle = Object.freeze({
      id,
      get name() {
        const name = 'name' in graph ? graph.name : undefined
        return typeof name === 'string' ? name : undefined
      },
      nodes: () => scoped.nodes(),
      node: (nodeId: string) => scoped.node(nodeId),
      groups: () => scoped.groups(),
      resolvedSupplies: () => scoped.resolvedSupplies()
    })
    byGraph.set(graph, handle)
    return handle
  }
}
