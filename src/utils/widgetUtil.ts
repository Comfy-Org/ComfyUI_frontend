import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

/**
 * Renames a widget and its corresponding input.
 *
 * @param widget The widget to rename
 * @param node The node containing the widget
 * @param newLabel The new label for the widget (empty string or undefined to clear)
 * @returns true if the rename was successful, false otherwise
 */
export function renameWidget(
  widget: IBaseWidget,
  node: LGraphNode,
  newLabel: string
): boolean {
  const input = node.inputs?.find((inp) => inp.widget?.name === widget.name)

  // Intentionally mutate the widget object here as it's a reference
  // to the actual widget in the graph
  widget.label = newLabel || undefined
  if (input) {
    input.label = newLabel || undefined
  }

  return true
}
