import type { ColorOption, LGraph } from '@comfyorg/litegraph'
import { LGraphGroup, LGraphNode, isColorable } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'
import _ from 'lodash'

import type { ComfyNode } from '@/schemas/comfyWorkflowSchema'

type ImageNode = LGraphNode & { imgs: HTMLImageElement[] | undefined }
type VideoNode = LGraphNode & {
  videoContainer: HTMLElement | undefined
  imgs: HTMLVideoElement[] | undefined
}

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

/**
 * Creates a copy of the nodes with non-serialized widget values removed
 */
export function filterSerializedWidgetValues(
  nodes: ComfyNode[],
  graph: LGraph
): ComfyNode[] {
  if (!graph) return nodes

  return nodes.map((node) => {
    if (!node.widgets_values) return node

    const graphNode = graph.getNodeById(node.id)
    if (!graphNode?.widgets) return node

    const filteredNode = { ...node }
    const serializedValues = []

    for (let i = 0; i < graphNode.widgets.length; i++) {
      const widget = graphNode.widgets[i]

      // Skip if widget is not serialized
      if (!widget.options || widget.options.serialize !== false) {
        const value = Array.isArray(node.widgets_values)
          ? node.widgets_values[i]
          : node.widgets_values[widget.name || i.toString()]
        serializedValues.push(
          typeof value === 'object' && value !== null ? value.value : value
        )
      }
    }

    filteredNode.widgets_values = serializedValues
    return filteredNode
  })
}
