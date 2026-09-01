import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export function hasWidgetNode(
  widget: IBaseWidget
): widget is IBaseWidget & { node: LGraphNode } {
  return 'node' in widget && !!widget.node
}
