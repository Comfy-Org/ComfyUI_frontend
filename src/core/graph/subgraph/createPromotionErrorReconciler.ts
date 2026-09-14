/**
 * Moves the missing-media error surface between the interior widget and its
 * host as promotion transfers value ownership.
 */
import type {
  LGraphNode,
  Subgraph,
  SubgraphEventMap,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'

interface PromotionErrorReconcilerHandlers {
  /** Drops candidates whose widget is no longer the editable value owner. */
  dropOutOfScope: () => void
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
  dropOutOfScope,
  rescanHost,
  removeHostWidgetCandidate
}: PromotionErrorReconcilerHandlers): PromotionErrorReconciler {
  const subscriptions = new Map<Subgraph, Subscription>()
  /** Hosts already counted, since onNodeAdded is replayed for existing nodes. */
  const attachedHosts = new WeakSet<LGraphNode>()

  /** Re-derives both sides once ownership has settled. */
  const reconcile = (subgraphNode: SubgraphNode) => {
    queueMicrotask(() => {
      dropOutOfScope()
      rescanHost(subgraphNode)
    })
  }

  const subscribe = (subgraph: Subgraph): (() => void) => {
    const onDemoted = (
      event: CustomEvent<SubgraphEventMap['widget-demoted']>
    ) => {
      const { subgraphNode, widget } = event.detail
      // Fires before the widget leaves the host input, so the scope filter
      // cannot see it gone yet.
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
    if (!node.isSubgraphNode()) return
    if (attachedHosts.has(node)) return
    attachedHosts.add(node)
    attach(node.subgraph)
  }

  const detachNode = (node: LGraphNode): void => {
    if (!node.isSubgraphNode()) return
    if (!attachedHosts.delete(node)) return
    detach(node.subgraph)
  }

  const dispose = (): void => {
    for (const { unsubscribe } of subscriptions.values()) unsubscribe()
    subscriptions.clear()
  }

  return { attachNode, detachNode, attach, dispose }
}
