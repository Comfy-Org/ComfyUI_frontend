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

import type {
  GraphMutationTarget,
  TargetedGraphOperations
} from './graphOperations'
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
}

export interface MintPortWiringDeps {
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /** Stable workflow/root identity for the graph currently being edited. */
  target(): GraphMutationTarget | null
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(batch: TargetedGraphOperations): boolean
  /** The layout store's `onChange`, injected by the composition root. */
  layoutChanges(listener: (change: LayoutChangeView) => void): () => void
  /** `ACTOR_CONFIG.USER_PREFIX`, injected by the composition root. */
  localActorPrefix: string
  /** The target's live root graph, or null when it is no longer active. */
  getGraph(target: GraphMutationTarget): MintableGraph | null
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
    changes: {
      onChange(listener) {
        return deps.layoutChanges((change) => {
          const target = deps.target()
          if (target) listener(target, change)
        })
      }
    },
    session,
    severedLinks: linkPort.severances,
    localActorPrefix: deps.localActorPrefix,
    isEnabled: deps.isEnabled,
    isDocBound: deps.isDocBound,
    target: deps.target,
    source: {
      serializeNode(target, id) {
        const node = deps.getGraph(target)?.getNodeById(id as NodeId)
        return node ? serializeForMint(node) : null
      },
      nodeIds(target) {
        return (deps.getGraph(target)?._nodes ?? []).map((node) => node.id)
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
    resolveInteriorPath(target, owningGraphId) {
      const graph = deps.getGraph(target)
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
    const target = deps.target()
    if (!target) return
    if (name === 'registerLink' || name === 'replaceLink') {
      const scope = args[0]
      after((placed) => {
        if (!placed || isFloatingTopology(placed)) return
        for (const listener of placedListeners) listener(target, scope, placed)
      })
      return
    }
    if (name === 'deleteLink') {
      const [scope, topology] = args
      after((removed) => {
        if (!removed || isFloatingTopology(topology)) return
        for (const listener of deletedListeners)
          listener(target, scope, topology)
      })
    }
  })

  const detachWidgetChanges = widgetStore.onValueChange(
    ({ widgetId, value, oldValue, context }) => {
      if (isRemoteMutationContext(context)) return
      const target = deps.target()
      if (!target) return
      const { graphId, nodeId, name: widgetName } = parseWidgetId(widgetId)
      for (const listener of setListeners) {
        listener(target, {
          graphId: String(graphId),
          nodeId,
          name: widgetName,
          value,
          old: oldValue
        })
      }
    }
  )

  let loadBracketOpen = false

  const wiring: MintPortWiring = {
    session,
    runIntentionalClear(fn) {
      return layoutPort.runIntentionalClear(fn)
    },
    onBeforeGraphLoad() {
      if (loadBracketOpen) return
      loadBracketOpen = true
      session.beginGraphTeardown()
    },
    onAfterGraphConfigure() {
      if (!loadBracketOpen) return
      loadBracketOpen = false
      session.endGraphTeardown()
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
