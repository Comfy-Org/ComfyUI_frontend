/**
 * Keeps the missing-media error surface aligned with promotion.
 *
 * Promoting a widget moves value ownership from the interior widget to the
 * host, and demoting moves it back. The error has to travel with ownership,
 * otherwise it stays keyed to a widget the user can no longer edit.
 *
 * Attach and detach are recursive and symmetric: a subgraph host that is added
 * brings its nested definitions with it, and one that is removed takes them
 * away again. Subscriptions are counted because several hosts can share one
 * definition, and removing one of them must not silence the others.
 */
import type {
  LGraphNode,
  Subgraph,
  SubgraphEventMap,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'

interface PromotionErrorReconcilerHandlers {
  /** Drops candidates whose widget is no longer the editable value owner. */
  pruneOutOfScope: () => void
  /** Rescans a host and its interior nodes for missing media. */
  rescanHost: (subgraphNode: SubgraphNode) => void
  /** Removes the host-keyed candidate for a widget that is being demoted. */
  removeHostWidgetCandidate: (
    subgraphNode: SubgraphNode,
    widgetName: string
  ) => void
}

export interface PromotionErrorReconciler {
  /** Subscribes a subgraph host and every definition nested inside it. */
  attachNode: (node: LGraphNode) => void
  /** Releases a subgraph host's subscriptions, and its nested ones. */
  detachNode: (node: LGraphNode) => void
  /** Subscribes a subgraph definition directly, for hooks installed on one. */
  attach: (subgraph: Subgraph) => void
  /** Releases everything still subscribed. */
  dispose: () => void
}

interface Subscription {
  unsubscribe: () => void
  hostCount: number
}

export function createPromotionErrorReconciler({
  pruneOutOfScope,
  rescanHost,
  removeHostWidgetCandidate
}: PromotionErrorReconcilerHandlers): PromotionErrorReconciler {
  const subscriptions = new Map<Subgraph, Subscription>()
  // useGraphNodeManager chains onNodeAdded and replays it for every node
  // already in the graph, so the same host arrives twice. Count hosts, not
  // arrivals, or the definition never drops to zero and is never released.
  const attachedHosts = new WeakSet<LGraphNode>()

  // Ownership has not settled when the event fires, so reconcile on the next
  // microtask: the side that lost it fails the scope check and is dropped, the
  // side that gained it is scanned fresh.
  const reconcile = (subgraphNode: SubgraphNode) => {
    queueMicrotask(() => {
      pruneOutOfScope()
      rescanHost(subgraphNode)
    })
  }

  const subscribe = (subgraph: Subgraph): (() => void) => {
    const onDemoted = (
      event: CustomEvent<SubgraphEventMap['widget-demoted']>
    ) => {
      const { subgraphNode, widget } = event.detail
      // The host input still carries the widget at this point, so the scope
      // filter cannot see it as gone yet.
      removeHostWidgetCandidate(subgraphNode, widget.name)
      reconcile(subgraphNode)
    }
    const onPromoted = (
      event: CustomEvent<SubgraphEventMap['widget-promoted']>
    ) => {
      reconcile(event.detail.subgraphNode)
    }

    subgraph.events.addEventListener('widget-demoted', onDemoted)
    subgraph.events.addEventListener('widget-promoted', onPromoted)
    return () => {
      subgraph.events.removeEventListener('widget-demoted', onDemoted)
      subgraph.events.removeEventListener('widget-promoted', onPromoted)
    }
  }

  const attach = (subgraph: Subgraph): void => {
    const existing = subscriptions.get(subgraph)
    if (existing) {
      existing.hostCount += 1
      return
    }

    subscriptions.set(subgraph, {
      unsubscribe: subscribe(subgraph),
      hostCount: 1
    })
    for (const node of subgraph.nodes) attachNode(node)
  }

  const detach = (subgraph: Subgraph): void => {
    const subscription = subscriptions.get(subgraph)
    if (!subscription) return

    subscription.hostCount -= 1
    if (subscription.hostCount > 0) return

    subscription.unsubscribe()
    subscriptions.delete(subgraph)
    for (const node of subgraph.nodes) detachNode(node)
  }

  const attachNode = (node: LGraphNode): void => {
    if (!node.isSubgraphNode?.()) return
    if (attachedHosts.has(node)) return
    attachedHosts.add(node)
    attach(node.subgraph)
  }

  const detachNode = (node: LGraphNode): void => {
    if (!node.isSubgraphNode?.()) return
    if (!attachedHosts.delete(node)) return
    detach(node.subgraph)
  }

  const dispose = (): void => {
    for (const { unsubscribe } of subscriptions.values()) unsubscribe()
    subscriptions.clear()
  }

  return { attachNode, detachNode, attach, dispose }
}
