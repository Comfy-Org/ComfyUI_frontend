import { setNodeWidgetValue } from '@/core/graph/widgets/nodeWidgetValues'
import type { LGraphNode } from '@comfyorg/litegraph/litegraph'

export const IMAGE_WIDGET = 'image'

export function writeImageWidgetValue(node: LGraphNode, value: string): void {
  if (!setNodeWidgetValue(node, IMAGE_WIDGET, value)) return
  node.properties[IMAGE_WIDGET] = value
}
