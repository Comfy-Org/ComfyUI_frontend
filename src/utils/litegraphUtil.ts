import type { IWidget } from '@comfyorg/litegraph'
import { LGraphGroup, LGraphNode } from '@comfyorg/litegraph'
import type { Positionable } from '@comfyorg/litegraph/dist/interfaces'
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

/**
 * Sets the color of an item based on the color option.
 * If the color option is null, the color of the item is deleted.
 * @param item - The item to set the color of.
 * @param colorOption - The color option to set the color of the item to.
 */
export const setItemColor = (
  item: Positionable,
  colorOption: {
    color: string
    bgcolor: string
    groupcolor: string
  } | null
): void => {
  if (item instanceof LGraphGroup) {
    if (colorOption) {
      item.color = colorOption.groupcolor
    } else {
      delete item.color
    }
  }

  if (item instanceof LGraphNode) {
    if (colorOption) {
      item.color = colorOption.color
      item.bgcolor = colorOption.bgcolor
    } else {
      delete item.color
      delete item.bgcolor
    }
  }
}
