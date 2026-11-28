import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

export interface LegacyWidgetGeometry {
  y: IBaseWidget['y']
  last_y: IBaseWidget['last_y']
  width: IBaseWidget['width']
  canvasHeight: LGraphNode['canvasHeight']
}

const widgetGeometryBeforeVueNodes = new WeakMap<
  IBaseWidget,
  Omit<LegacyWidgetGeometry, 'canvasHeight'>
>()
const canvasHeightBeforeVueNodes = new WeakMap<
  LGraphNode,
  LGraphNode['canvasHeight']
>()

export function readLegacyWidgetGeometry(
  widget: IBaseWidget,
  node: LGraphNode
): LegacyWidgetGeometry {
  return {
    y: widget.y,
    last_y: widget.last_y,
    width: widget.width,
    canvasHeight: node.canvasHeight
  }
}

export function writeLegacyWidgetGeometry(
  widget: IBaseWidget,
  node: LGraphNode,
  { y, last_y, width, canvasHeight }: LegacyWidgetGeometry
) {
  widget.y = y
  widget.last_y = last_y
  widget.width = width
  node.canvasHeight = canvasHeight
}

export function rememberGeometryBeforeVueNodes(
  widget: IBaseWidget,
  node: LGraphNode,
  { canvasHeight, ...widgetGeometry }: LegacyWidgetGeometry
) {
  if (!widgetGeometryBeforeVueNodes.has(widget))
    widgetGeometryBeforeVueNodes.set(widget, widgetGeometry)
  if (!canvasHeightBeforeVueNodes.has(node))
    canvasHeightBeforeVueNodes.set(node, canvasHeight)
}

/** Restores the canvas geometry a node and its legacy widgets had before Vue nodes drew them. */
export function restoreGeometryBeforeVueNodes(node: LGraphNode) {
  if (canvasHeightBeforeVueNodes.has(node)) {
    node.canvasHeight = canvasHeightBeforeVueNodes.get(node)
    canvasHeightBeforeVueNodes.delete(node)
  }
  for (const widget of node.widgets ?? []) {
    const geometry = widgetGeometryBeforeVueNodes.get(widget)
    if (!geometry) continue
    widget.y = geometry.y
    widget.last_y = geometry.last_y
    widget.width = geometry.width
    widgetGeometryBeforeVueNodes.delete(widget)
  }
}
