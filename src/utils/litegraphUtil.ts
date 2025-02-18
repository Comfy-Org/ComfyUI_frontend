import type { IWidget, LGraphNode } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

export function isImageNode(node: LGraphNode) {
  return (
    node.imgs ||
    (node &&
      node.widgets &&
      node.widgets.findIndex((obj: IWidget) => obj.name === 'image') >= 0)
  )
}

export function addToComboValues(widget: IComboWidget, value: string) {
  if (!widget.options) widget.options = { values: [] }
  if (!widget.options.values) widget.options.values = []
  if (!widget.options.values.includes(value)) {
    widget.options.values.push(value)
  }
}

export const isLGraphNode = (item: unknown): item is LGraphNode => {
  const name = item?.constructor?.name
  return name === 'ComfyNode' || name === 'LGraphNode'
}
