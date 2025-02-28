import type { ColorOption } from '@comfyorg/litegraph'
import {
  LGraphGroup,
  LGraphNode,
  LiteGraph,
  isColorable
} from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'
import _ from 'lodash'

import { ModelFile } from '@/schemas/comfyWorkflowSchema'

type ImageNode = LGraphNode & { imgs: HTMLImageElement[] | undefined }
type VideoNode = LGraphNode & {
  videoContainer: HTMLElement | undefined
  imgs: HTMLVideoElement[] | undefined
}
type ModelNode = LGraphNode & {
  properties: {
    models?: ModelFile[]
  }
}

const MODEL_OUTPUT_TYPES = new Set([
  'MODEL',
  'CLIP',
  'VAE',
  'CONTROL_NET',
  'UPSCALE_MODEL',
  'CLIP_VISION',
  'STYLE_MODEL',
  'GLIGEN',
  'HOOKS',
  'UPSCALE_MODEL',
  'PHOTOMAKER',
  'SAM_MODEL'
])

export function isImageNode(node: LGraphNode | undefined): node is ImageNode {
  if (!node) return false
  return (
    node.previewMediaType === 'image' ||
    (node.previewMediaType !== 'video' && !!node.imgs?.length)
  )
}

export function isVideoNode(node: LGraphNode | undefined): node is VideoNode {
  if (!node) return false
  return node.previewMediaType === 'video' || !!node.videoContainer
}

export function isAudioNode(node: LGraphNode | undefined): boolean {
  return !!node && node.previewMediaType === 'audio'
}

export const isModelNode = (node: unknown): node is ModelNode => {
  if (!isLGraphNode(node)) return false
  if (node.properties?.models) return true
  if (!node.outputs?.length) return false
  return node.outputs.some((output) => MODEL_OUTPUT_TYPES.has(`${output.type}`))
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
