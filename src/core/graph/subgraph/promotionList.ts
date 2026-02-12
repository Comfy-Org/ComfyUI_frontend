import type { ProxyWidgetsProperty } from '@/core/schemas/proxyWidget'
import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

/**
 * Returns the list of promoted widget entries from a SubgraphNode.
 * Each entry is a [nodeId, widgetName] tuple referencing an interior widget.
 *
 * This is the single entry point for reading the promotion list,
 * replacing direct access to `node.properties.proxyWidgets`.
 */
export function getPromotionList(node: SubgraphNode): ProxyWidgetsProperty {
  if (node.properties.proxyWidgets == null) return []
  return parseProxyWidgets(node.properties.proxyWidgets)
}
