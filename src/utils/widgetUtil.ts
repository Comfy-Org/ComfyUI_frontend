import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetView'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

/**
 * Renames a widget and its corresponding input.
 * Handles both regular widgets and promoted widget views in subgraphs.
 *
 * @param widget The widget to rename
 * @param node The node containing the widget
 * @param newLabel The new label for the widget (empty string or undefined to clear)
 * @param parents Optional array of parent SubgraphNodes (for promoted widgets)
 * @returns true if the rename was successful, false otherwise
 */
export function renameWidget(
  widget: IBaseWidget,
  node: LGraphNode,
  newLabel: string,
  parents?: SubgraphNode[]
): boolean {
  if (isPromotedWidgetView(widget) && parents?.length) {
    const view = widget
    const subgraph = parents[0].subgraph
    if (!subgraph) {
      console.error('Could not find subgraph for promoted widget')
      return false
    }
    const interiorNode = subgraph.getNodeById(view.sourceNodeId)

    if (!interiorNode) {
      console.error('Could not find interior node for promoted widget')
      return false
    }

    const originalWidget = interiorNode.widgets?.find(
      (w) => w.name === view.sourceWidgetName
    )

    if (!originalWidget) {
      console.error('Could not find original widget for promoted widget')
      return false
    }

    originalWidget.label = newLabel || undefined

    const interiorInput = interiorNode.inputs?.find(
      (inp) => inp.widget?.name === view.sourceWidgetName
    )
    if (interiorInput) {
      interiorInput.label = newLabel || undefined
    }
  }

  const input = node.inputs?.find((inp) => inp.widget?.name === widget.name)

  widget.label = newLabel || undefined
  if (input) {
    input.label = newLabel || undefined
  }

  return true
}
