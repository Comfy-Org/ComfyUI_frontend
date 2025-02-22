import type { ColorOption } from '@comfyorg/litegraph'
import {
  LGraphGroup,
  LGraphNode,
  LiteGraph,
  isColorable
} from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'
import _ from 'lodash'

import { ComfyInputsSpec, ComfyNodeDef, InputSpec } from '@/types/apiTypes'

const IMAGE_NODE_PROPERTY = 'image_upload'
const VIDEO_NODE_PROPERTY = 'video_upload'

const getNodeData = (node: LGraphNode): ComfyNodeDef | undefined =>
  node.constructor?.nodeData as ComfyNodeDef | undefined

const getInputSpecsFromData = (
  inputData: ComfyInputsSpec | undefined
): InputSpec[] => {
  if (!inputData) return []

  const { required, optional } = inputData
  const inputSpecs: InputSpec[] = []
  if (required) {
    for (const value of Object.values(required)) {
      inputSpecs.push(value)
    }
  }
  if (optional) {
    for (const value of Object.values(optional)) {
      inputSpecs.push(value)
    }
  }
  return inputSpecs
}

const hasImageElements = (imgs: unknown[]): boolean =>
  Array.isArray(imgs) &&
  imgs.some((img): img is HTMLImageElement => img instanceof HTMLImageElement)

const hasInputProperty = (
  node: LGraphNode | undefined,
  property: string
): boolean => {
  if (!node) return false
  const nodeData = getNodeData(node)
  if (!nodeData?.input) return false

  const inputs = getInputSpecsFromData(nodeData.input)
  return inputs.some((input) => input?.[1]?.[property])
}

type ImageNode = LGraphNode & { imgs: HTMLImageElement[] }
type VideoNode = LGraphNode & { videoContainer: HTMLElement }

export function isImageNode(node: LGraphNode | undefined): node is ImageNode {
  if (!node) return false
  if (node.imgs?.length && hasImageElements(node.imgs)) return true
  if (!node.widgets) return false

  return hasInputProperty(node, IMAGE_NODE_PROPERTY)
}

export function isVideoNode(node: LGraphNode | undefined): node is VideoNode {
  if (!node) return false
  if (node.videoContainer) return true
  if (!node.widgets) return false

  return hasInputProperty(node, VIDEO_NODE_PROPERTY)
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
      shiftY += LiteGraph.NODE_WIDGET_HEIGHT + 4
    }
  } else {
    return node.computeSize()[1]
  }
  return shiftY
}
