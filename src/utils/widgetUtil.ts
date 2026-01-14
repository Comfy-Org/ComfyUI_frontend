import { isProxyWidget } from '@/core/graph/subgraph/proxyWidget'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

/**
 * Renames a widget and its corresponding input.
 * Handles both regular widgets and proxy widgets in subgraphs.
 *
 * @param widget The widget to rename
 * @param node The node containing the widget
 * @param newLabel The new label for the widget (empty string or undefined to clear)
 * @param parents Optional array of parent SubgraphNodes (for proxy widgets)
 * @returns true if the rename was successful, false otherwise
 */
export function renameWidget(
  widget: IBaseWidget,
  node: LGraphNode,
  newLabel: string,
  parents?: SubgraphNode[]
): boolean {
  // For proxy widgets in subgraphs, we need to rename the original interior widget
  if (isProxyWidget(widget) && parents?.length) {
    const subgraph = parents[0].subgraph
    if (!subgraph) {
      console.error('Could not find subgraph for proxy widget')
      return false
    }
    const interiorNode = subgraph.getNodeById(parseInt(widget._overlay.nodeId))

    if (!interiorNode) {
      console.error('Could not find interior node for proxy widget')
      return false
    }

    const originalWidget = interiorNode.widgets?.find(
      (w) => w.name === widget._overlay.widgetName
    )

    if (!originalWidget) {
      console.error('Could not find original widget for proxy widget')
      return false
    }

    // Rename the original widget
    originalWidget.label = newLabel || undefined

    // Also rename the corresponding input on the interior node
    const interiorInput = interiorNode.inputs?.find(
      (inp) => inp.widget?.name === widget._overlay.widgetName
    )
    if (interiorInput) {
      interiorInput.label = newLabel || undefined
    }
  }

  // Always rename the widget on the current node (either regular widget or proxy widget)
  const input = node.inputs?.find((inp) => inp.widget?.name === widget.name)

  // Intentionally mutate the widget object here as it's a reference
  // to the actual widget in the graph
  widget.label = newLabel || undefined
  if (input) {
    input.label = newLabel || undefined
  }

  return true
}
