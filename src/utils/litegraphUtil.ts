import type { IWidget, LGraphNode } from '@comfyorg/litegraph'

export function isImageNode(node: LGraphNode) {
  return (
    node.imgs ||
    (node &&
      node.widgets &&
      node.widgets.findIndex((obj: IWidget) => obj.name === 'image') >= 0)
  )
}
