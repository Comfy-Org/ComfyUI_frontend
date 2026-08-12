/**
 * `GraphHandle` — the root of the public graph surface, and the place where the
 * per-node collections are composed and cached.
 *
 * This is the only module that knows how the pieces fit together; everything
 * below it is independently testable.
 */
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { toNodeId } from '@/types/nodeId'

import { ComfyApiError } from './errors'
import { createGroupHandles } from './groupHandle'
import type { GroupHandle } from './groupHandle'
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
  namespace = ''
): GraphHandle {
  const nodeById = (nodeId: string) =>
    getGraph()?.getNodeById(toNodeId(nodeId)) ?? undefined

  const widgetHandles = createWidgetHandles(getGraph, namespace)

  const inputsFor = weakCache<SlotCollection<InputSlotHandle>>((nodeId) =>
    createInputCollection(getGraph, () => nodeById(nodeId))
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

    get cacheSize() {
      return nodeHandles.cacheSize + widgetHandles.cacheSize
    }
  }

  return Object.freeze(api)
}
