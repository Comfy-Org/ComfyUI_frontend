/**
 * Composition seam for the three mint ports. Layout pieces are injected
 * (workbench must not import renderer); link/widget adapt via Pinia $onAction,
 * which fires synchronously around each action. A replace maps to PLACED and
 * never DELETED (the store displaces incumbents internally). Load brackets
 * are depth-counted over beforeLoadGraph/afterConfigureGraph so overlapping
 * loads cannot reopen minting while either graph is still configuring.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeId } from '@/types/nodeId'
import type { WidgetId } from '@/types/widgetId'
import type { WorkflowNode } from '@comfyorg/comfy-multi-player'

import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { isFloatingTopology } from '@/types/linkTopology'
import { parseWidgetId } from '@/types/widgetId'
import { findSubgraphNodePathById } from '@/utils/graphTraversalUtil'

import type { GraphOperation } from './graphOperations'
import { AGENT_REMOTE_ACTOR, attachLayoutMintPort } from './layoutMintPort'
import type { LayoutChangeView, LayoutMintPort } from './layoutMintPort'
import { attachLinkMintPort } from './linkMintPort'
import { attachWidgetMintPort } from './widgetMintPort'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'

/** The graph surface the wiring reads for snapshots and scope. */
export interface MintableGraph {
  id: string
  rootGraph?: { id: string }
  getNodeById(id: NodeId | string): LGraphNode | null
  _nodes: LGraphNode[]
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
  /** The layout store's `withActor`, injected by the composition root. */
  withLayoutActor(actor: string, fn: () => void): void
  /** `ACTOR_CONFIG.USER_PREFIX`, injected by the composition root. */
  localActorPrefix: string
  /** The live root graph, or null when no workflow is open. */
  getGraph(): MintableGraph | null
}

export interface MintPortWiring {
  session: MintSession
  /** Hand to {@link LitegraphMutator}'s `runRemoteScope` dep verbatim. */
  runRemoteScope(apply: () => void): void
  /** The layout port's intentional-clear window (human clear paths only). */
  runIntentionalClear<T>(fn: () => T): T
  /** Forward from the app extension's `beforeLoadGraph` hook. */
  onBeforeGraphLoad(): void
  /** Forward from the app extension's `afterConfigureGraph` hook. */
  onAfterGraphConfigure(): void
  detach(): void
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
    changes: { onChange: deps.layoutChanges },
    session,
    severedLinks: linkPort.severances,
    localActorPrefix: deps.localActorPrefix,
    isEnabled: deps.isEnabled,
    isDocBound: deps.isDocBound,
    source: {
      rootGraphId() {
        const graph = deps.getGraph()
        return graph ? String(graph.rootGraph?.id ?? graph.id) : null
      },
      serializeNode(id) {
        const node = deps.getGraph()?.getNodeById(id)
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
      return String(graph.rootGraph?.id ?? graph.id)
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

  const detachWidgetActions = widgetStore.$onAction(({ name, args, after }) => {
    if (name !== 'setValue') return
    const widgetId = args[0] as WidgetId
    const old = widgetStore.getWidget(widgetId)?.value
    after((applied) => {
      if (!applied) return
      const { graphId, nodeId, name: widgetName } = parseWidgetId(widgetId)
      for (const listener of setListeners) {
        listener({
          graphId: String(graphId),
          nodeId,
          name: widgetName,
          value: args[1],
          old
        })
      }
    })
  })

  return {
    session,
    runRemoteScope(apply) {
      session.runRemoteApply(() => {
        deps.withLayoutActor(AGENT_REMOTE_ACTOR, apply)
      })
    },
    runIntentionalClear(fn) {
      return layoutPort.runIntentionalClear(fn)
    },
    onBeforeGraphLoad() {
      session.beginGraphTeardown()
    },
    onAfterGraphConfigure() {
      session.endGraphTeardown()
    },
    detach() {
      detachLinkActions()
      detachWidgetActions()
      widgetPort.detach()
      layoutPort.detach()
      linkPort.detach()
    }
  }
}
