import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  DefaultConnectionColors,
  Point
} from '@/lib/litegraph/src/interfaces'
import type {
  NodeBox,
  NodeBoxSlot,
  NodeBoxWidget
} from '@/renderer/core/canvas/nodeBoxRenderer'

const WIDGET_MARGIN = 15

export interface NodeBoxColors {
  body?: string
  title?: string
}

export interface CreateNodeBoxOptions {
  colourGetter?: DefaultConnectionColors
  getSlotPosition: (node: LGraphNode, index: number, isInput: boolean) => Point
  isSlotColorRenderable: (color: string) => boolean
  widgetHeight: number
}

export function createNodeBox(
  node: LGraphNode,
  colors: NodeBoxColors | undefined,
  {
    colourGetter,
    getSlotPosition,
    isSlotColorRenderable,
    widgetHeight
  }: CreateNodeBoxOptions
): NodeBox {
  const [x, y, width, height] = node.boundingRect
  const bounds = { x, y, width, height }
  const titleHeight = Math.max(0, node.pos[1] - y)

  if (node.flags?.collapsed) {
    return {
      bounds,
      color: colors?.body,
      titleColor: colors?.title,
      titleHeight
    }
  }

  const slots: NodeBoxSlot[] = []
  const addSlot = (
    slot: { type?: unknown },
    index: number,
    isInput: boolean
  ) => {
    const [slotX, slotY] = getSlotPosition(node, index, isInput)
    const type = String(slot.type ?? '')
    const connected = isInput
      ? node.isInputConnected(index)
      : node.isOutputConnected(index)
    const slotColor = connected
      ? colourGetter?.getConnectedColor(type)
      : colourGetter?.getDisconnectedColor(type)
    slots.push({
      x: slotX,
      y: slotY,
      color:
        typeof slotColor === 'string' && isSlotColorRenderable(slotColor)
          ? slotColor
          : undefined
    })
  }
  node.inputs?.forEach((slot, index) => addSlot(slot, index, true))
  node.outputs?.forEach((slot, index) => addSlot(slot, index, false))

  const widgets: NodeBoxWidget[] = []
  for (const widget of node.widgets ?? []) {
    if (!node.isWidgetVisible(widget)) continue
    widgets.push({
      x: node.pos[0] + WIDGET_MARGIN,
      y: node.pos[1] + widget.y,
      width: node.size[0] - WIDGET_MARGIN * 2,
      height: widgetHeight
    })
  }

  return {
    bounds,
    color: colors?.body,
    titleColor: colors?.title,
    titleHeight,
    slots,
    widgets
  }
}
