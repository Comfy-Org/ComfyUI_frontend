/**
 * Composition seam for the three mint ports. Layout pieces are injected
 * (workbench must not import renderer); link and widget events come from their
 * owning stores. A replace maps to PLACED and never DELETED (the store
 * displaces incumbents internally). Load brackets are a fail-closed boolean
 * over beforeLoadGraph/afterConfigureGraph: a failed load leaves mints
 * suppressed until the next load's pair recloses.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeId } from '@/types/nodeId'
import type { WorkflowNode } from '@comfyorg/comfy-multi-player'

import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { isFloatingTopology } from '@/types/linkTopology'
import { isRemoteMutationContext } from '@/types/graphMutationContext'
import { parseWidgetId } from '@/types/widgetId'
import { findSubgraphNodePathById } from '@/utils/graphTraversalUtil'

import type { GraphOperation } from './graphOperations'
import { attachLayoutMintPort } from './layoutMintPort'
import type { LayoutChangeView, LayoutMintPort } from './layoutMintPort'
import { attachLinkMintPort } from './linkMintPort'
import { attachWidgetMintPort } from './widgetMintPort'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'

/** The graph surface the wiring reads for snapshots and scope. */
export interface MintableGraph {
  id: string
  rootGraph?: { id: string }
  getNodeById(id: NodeId): LGraphNode | null
  _nodes: LGraphNode[]
  /** Root-graph links; read only to diff an undo/redo restore. */
  links?: { values(): Iterable<MintableLink> }
}

/** The link fields an undo/redo restore diff needs. */
export interface MintableLink {
  id: string | number
  origin_id: string | number
  origin_slot: number
  target_id: string | number
  target_slot: number
  type: unknown
}

export interface MintPortWiringDeps {
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
  /** The layout store's `onChange`, injected by the composition root. */
  layoutChanges(listener: (change: LayoutChangeView) => void): () => void
  /** `ACTOR_CONFIG.USER_PREFIX`, injected by the composition root. */
  localActorPrefix: string
  /** The live root graph, or null when no workflow is open. */
  getGraph(): MintableGraph | null
  /**
   * True while the active workflow's ChangeTracker replays an undo/redo
   * state (`_restoringState`). Such a load is a human intent whose result
   * must reach the doc, so the wiring diffs the graph across the load bracket
   * and mints the difference (QAF-51). Optional: absent means never.
   */
  isRestoringState?(): boolean
}

export interface MintPortWiring {
  session: MintSession
  /** The layout port's intentional-clear window (human clear paths only). */
  runIntentionalClear<T>(fn: () => T): T
  /** Forward from the app extension's `beforeLoadGraph` hook. */
  onBeforeGraphLoad(): void
  /** Forward from the app extension's `afterConfigureGraph` hook. */
  onAfterGraphConfigure(): void
  detach(): void
}

const activeWirings = new Set<MintPortWiring>()

export function notifyMintPortsBeforeGraphLoad(): void {
  for (const wiring of activeWirings) wiring.onBeforeGraphLoad()
}

export function notifyMintPortsAfterGraphConfigure(): void {
  for (const wiring of activeWirings) wiring.onAfterGraphConfigure()
}

/**
 * Run a graph mutation that replays already-committed remote state (so the
 * live graph catches up with the stores) without any active mint port echoing
 * it back into the doc as a local op.
 */
export function runMintPortsSuppressed<T>(fn: () => T): T {
  const wirings = [...activeWirings]
  for (const wiring of wirings) wiring.session.beginGraphTeardown()
  try {
    return fn()
  } finally {
    for (const wiring of wirings) wiring.session.endGraphTeardown()
  }
}

/** Run a confirmed root-workflow clear through every active mint port. */
export function runMintPortsIntentionalClear<T>(clear: () => T): T {
  const wirings = [...activeWirings]
  const run = (index: number): T =>
    index === wirings.length
      ? clear()
      : wirings[index].runIntentionalClear(() => run(index + 1))
  return run(0)
}

/**
 * Serialized save-format node, `widgets_values` NAME-KEYED via the node's own
 * `widgets_values_named` minus non-value widgets (FE-1904: the doc host's
 * sidecar projection accepts only the pinned catalog's `widget_order` names;
 * control widgets like a `button` serialize a named entry but are not in
 * `widget_order`, and any extra key is an opaque server-side 500).
 */
function serializeForMint(node: LGraphNode): WorkflowNode | null {
  let serialized: Record<string, unknown>
  try {
    serialized = node.serialize() as unknown as Record<string, unknown>
  } catch {
    return null
  }
  const named = serialized.widgets_values_named
  if (named != null && typeof named === 'object') {
    const filtered: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(named)) {
      const widget = node.widgets?.find((candidate) => candidate.name === name)
      if (widget && widget.type !== 'button' && widget.serialize !== false) {
        filtered[name] = value
      }
    }
    serialized.widgets_values = filtered
    delete serialized.widgets_values_named
  }
  return serialized as unknown as WorkflowNode
}

/** Root-graph nodes and links keyed by stringified id (undo/redo diff input). */
interface RestoreSnapshot {
  nodes: Map<string, WorkflowNode>
  links: Map<string, MintableLink>
}

function snapshotGraph(graph: MintableGraph): RestoreSnapshot {
  const nodes = new Map<string, WorkflowNode>()
  for (const node of graph._nodes ?? []) {
    const serialized = serializeForMint(node)
    if (serialized) nodes.set(String(node.id), serialized)
  }
  const links = new Map<string, MintableLink>()
  if (typeof graph.links?.values === 'function') {
    for (const link of graph.links.values()) links.set(String(link.id), link)
  }
  return { nodes, links }
}

function widgetValuesOf(node: WorkflowNode): Record<string, unknown> {
  const values = node.widgets_values
  return values != null && typeof values === 'object' && !Array.isArray(values)
    ? (values as Record<string, unknown>)
    : {}
}

/**
 * Express an undo/redo restore as the semantic ops a human would have minted
 * by hand: deletions first (with the links they severed), then additions,
 * widget changes on surviving nodes, and finally new links. A link that
 * vanished without its node is not representable as a mint here and is
 * surfaced, never silently dropped.
 */
function diffRestore(
  before: RestoreSnapshot,
  after: RestoreSnapshot
): GraphOperation[] {
  const operations: GraphOperation[] = []

  for (const [id] of before.nodes) {
    if (after.nodes.has(id)) continue
    const removedLinks: Array<string | number> = []
    for (const link of before.links.values()) {
      if (String(link.origin_id) === id || String(link.target_id) === id) {
        removedLinks.push(link.id)
      }
    }
    operations.push({
      op: 'delete_node',
      node_id: id,
      removed_links: removedLinks
    })
  }

  for (const [id, node] of after.nodes) {
    if (before.nodes.has(id)) continue
    const pos = Array.isArray(node.pos) ? node.pos : [0, 0]
    operations.push({
      op: 'add_node',
      node_id: id,
      class_type: node.type,
      pos,
      node
    })
  }

  for (const [id, node] of after.nodes) {
    const previous = before.nodes.get(id)
    if (!previous) continue
    const oldValues = widgetValuesOf(previous)
    for (const [name, value] of Object.entries(widgetValuesOf(node))) {
      const old = oldValues[name]
      if (JSON.stringify(old) === JSON.stringify(value)) continue
      operations.push({
        op: 'set_widget',
        node_id: id,
        widget: name,
        value,
        old
      })
    }
  }

  for (const [id, link] of after.links) {
    if (before.links.has(id)) continue
    operations.push({
      op: 'connect',
      link_id: link.id,
      from_node: link.origin_id,
      from_slot: link.origin_slot,
      to_node: link.target_id,
      to_slot: link.target_slot,
      link_type: String(link.type)
    })
  }

  for (const [id, link] of before.links) {
    if (after.links.has(id)) continue
    const endpointRemoved =
      !after.nodes.has(String(link.origin_id)) ||
      !after.nodes.has(String(link.target_id))
    if (endpointRemoved) continue
    console.error(
      '[agent-crdt] undo/redo restore removed link without its node; doc may diverge',
      id
    )
  }

  return operations
}

export function attachMintPortWiring(deps: MintPortWiringDeps): MintPortWiring {
  const session = createMintSession()

  type PlacedListener = Parameters<
    Parameters<typeof attachLinkMintPort>[0]['events']['onPlaced']
  >[0]
  type DeletedListener = Parameters<
    Parameters<typeof attachLinkMintPort>[0]['events']['onDeleted']
  >[0]
  type SetListener = Parameters<
    Parameters<typeof attachWidgetMintPort>[0]['events']['onSet']
  >[0]
  const placedListeners = new Set<PlacedListener>()
  const deletedListeners = new Set<DeletedListener>()
  const setListeners = new Set<SetListener>()

  const linkPort = attachLinkMintPort({
    events: {
      onPlaced(listener) {
        placedListeners.add(listener)
        return () => placedListeners.delete(listener)
      },
      onDeleted(listener) {
        deletedListeners.add(listener)
        return () => deletedListeners.delete(listener)
      }
    },
    session,
    isEnabled: deps.isEnabled,
    isDocBound: deps.isDocBound,
    enqueue: deps.enqueue
  })

  const layoutPort: LayoutMintPort = attachLayoutMintPort({
    changes: { onChange: deps.layoutChanges },
    session,
    severedLinks: linkPort.severances,
    localActorPrefix: deps.localActorPrefix,
    isEnabled: deps.isEnabled,
    isDocBound: deps.isDocBound,
    source: {
      serializeNode(id) {
        const node = deps.getGraph()?.getNodeById(id as NodeId)
        return node ? serializeForMint(node) : null
      },
      nodeIds() {
        return (deps.getGraph()?._nodes ?? []).map((node) => node.id)
      }
    },
    enqueue: deps.enqueue
  })

  const widgetPort = attachWidgetMintPort({
    events: {
      onSet(listener) {
        setListeners.add(listener)
        return () => setListeners.delete(listener)
      }
    },
    session,
    isEnabled: deps.isEnabled,
    isDocBound: deps.isDocBound,
    rootGraphId() {
      const graph = deps.getGraph()
      if (!graph) return null
      return graph.rootGraph?.id ?? graph.id
    },
    resolveInteriorPath(owningGraphId) {
      const graph = deps.getGraph()
      if (!graph) return null
      return findSubgraphNodePathById(graph as unknown as LGraph, owningGraphId)
    },
    enqueue: deps.enqueue
  })

  const linkStore = useLinkStore()
  const widgetStore = useWidgetValueStore()

  const detachLinkActions = linkStore.$onAction(({ name, args, after }) => {
    // The remote origin travels on the store call itself. Do not rely on the
    // old ambient MintSession scope: nested legacy setters can overwrite it.
    if (isRemoteMutationContext(args.at(-1))) return
    if (name === 'registerLink' || name === 'replaceLink') {
      const scope = args[0]
      after((placed) => {
        if (!placed || isFloatingTopology(placed)) return
        for (const listener of placedListeners) listener(scope, placed)
      })
      return
    }
    if (name === 'deleteLink') {
      const [scope, topology] = args
      after((removed) => {
        if (!removed || isFloatingTopology(topology)) return
        for (const listener of deletedListeners) listener(scope, topology)
      })
    }
  })

  const detachWidgetChanges = widgetStore.onValueChange(
    ({ widgetId, value, oldValue, context }) => {
      if (isRemoteMutationContext(context)) return
      const { graphId, nodeId, name: widgetName } = parseWidgetId(widgetId)
      for (const listener of setListeners) {
        listener({
          graphId,
          nodeId,
          name: widgetName,
          value,
          old: oldValue
        })
      }
    }
  )

  let loadBracketOpen = false

  /**
   * Graph snapshot taken at the open of an undo/redo restore bracket. Every
   * mint is suppressed while a graph loads, so without this diff the doc never
   * learns what the undo removed and the next remote frame re-materialises it
   * (QAF-51).
   */
  let restoreSnapshot: RestoreSnapshot | null = null

  const wiring: MintPortWiring = {
    session,
    runIntentionalClear(fn) {
      return layoutPort.runIntentionalClear(fn)
    },
    onBeforeGraphLoad() {
      if (loadBracketOpen) return
      loadBracketOpen = true
      session.beginGraphTeardown()
      restoreSnapshot = null
      if (deps.isRestoringState?.() && deps.isEnabled() && deps.isDocBound()) {
        const graph = deps.getGraph()
        if (graph) restoreSnapshot = snapshotGraph(graph)
      }
    },
    onAfterGraphConfigure() {
      if (!loadBracketOpen) return
      loadBracketOpen = false
      session.endGraphTeardown()
      const before = restoreSnapshot
      restoreSnapshot = null
      if (!before) return
      const graph = deps.getGraph()
      if (!graph) return
      const operations = diffRestore(before, snapshotGraph(graph))
      if (operations.length > 0) deps.enqueue(operations)
    },
    detach() {
      activeWirings.delete(wiring)
      detachLinkActions()
      detachWidgetChanges()
      widgetPort.detach()
      layoutPort.detach()
      linkPort.detach()
    }
  }
  activeWirings.add(wiring)
  return wiring
}
