import { parseProxyWidgets } from '@/core/schemas/promotionSchema'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

/**
 * Forward-ratchet legacy `properties.proxyWidgets` into real
 * SubgraphInput links. Unresolvable entries are dropped silently.
 * Idempotent: removes the legacy property after running.
 */
export function migrateLegacyProxyWidgets(hostNode: SubgraphNode): void {
  const tuples = parseProxyWidgets(hostNode.properties.proxyWidgets)
  if (tuples.length === 0) {
    delete hostNode.properties.proxyWidgets
    return
  }

  const { subgraph } = hostNode

  for (const [sourceNodeId, sourceWidgetName] of tuples) {
    const sourceNode = subgraph.getNodeById(sourceNodeId)
    if (!sourceNode) continue

    const sourceWidget = sourceNode.widgets?.find(
      (w) => w.name === sourceWidgetName
    )
    if (!sourceWidget) continue

    const sourceSlot = sourceNode.getSlotFromWidget(sourceWidget)
    if (!sourceSlot) continue

    if (sourceSlot.link != null) continue

    const desiredName = nextUniqueName(
      sourceWidgetName,
      subgraph.inputs.map((i) => i.name)
    )
    const slotType = String(sourceSlot.type ?? sourceWidget.type ?? '*')
    const subgraphInput = subgraph.addInput(desiredName, slotType)
    const link = subgraphInput.connect(sourceSlot, sourceNode)
    if (!link) subgraph.removeInput(subgraphInput)
  }

  delete hostNode.properties.proxyWidgets
}
