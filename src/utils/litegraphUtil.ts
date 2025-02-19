import type { ColorOption, IWidget } from '@comfyorg/litegraph'
import { LGraphGroup, LGraphNode, isColorable, LiteGraph } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'
import _ from 'lodash'

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
  return item instanceof LGraphNode
}

export const isLGraphGroup = (item: unknown): item is LGraphGroup => {
  return item instanceof LGraphGroup
}

/**
 * Get the color option of all canvas items if they are all the same.
 * @param items - The items to get the color option of.
 * @returns The color option of the item.
 */
export const getItemsColorOption = (items: unknown[]): ColorOption | null => {
  const validItems = _.filter(items, isColorable)
  if (_.isEmpty(validItems)) return null

  const colorOptions = _.map(validItems, (item) => item.getColorOption())

  return _.every(colorOptions, (option) =>
    _.isEqual(option, _.head(colorOptions))
  )
    ? _.head(colorOptions)!
    : null
}

export function executeWidgetsCallback(
  nodes: LGraphNode[],
  callbackName: 'onRemove' | 'beforeQueued' | 'afterQueued'
) {
  for (const node of nodes) {
    for (const widget of node.widgets ?? []) {
      widget[callbackName]?.()
    }
  }
}

export function getImageTop(node: LGraphNode) {
  let shiftY: number
  if (node.imageOffset != null) {
    return node.imageOffset
  } else if (node.widgets?.length) {
    const w = node.widgets[node.widgets.length - 1]
    shiftY = w.last_y ?? 0
    if (w.computeSize) {
      shiftY += w.computeSize()[1] + 4
    } else if (w.computedHeight) {
      shiftY += w.computedHeight
    } else {
      console.log('NODE_WIDGET_HEIGHT', LiteGraph.NODE_WIDGET_HEIGHT)
      shiftY += LiteGraph.NODE_WIDGET_HEIGHT + 4
    }
  } else {
    return node.computeSize()[1]
  }
  return shiftY
}
