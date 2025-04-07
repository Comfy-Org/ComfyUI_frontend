import type { ColorOption } from '@comfyorg/litegraph'
import { LGraphGroup, LGraphNode, isColorable } from '@comfyorg/litegraph'
import type {
  IComboWidget,
  IWidget
} from '@comfyorg/litegraph/dist/types/widgets'
import _ from 'lodash'

import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

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
 * Since frontend version 1.16, forceInput input is no longer treated
 * as widget. So we need to remove the dummy widget value serialized
 * from workflows prior to v1.16.
 * Ref: https://github.com/Comfy-Org/ComfyUI_frontend/pull/3326
 *
 * @param nodeDef the node definition
 * @param widgets the widgets on the node instance (from node definition)
 * @param widgetsValues the widgets values to populate the node during configuration
 * @returns the widgets values without the dummy widget values
 */
export function migrateWidgetsValues<TWidgetValue>(
  inputDefs: Record<string, InputSpec>,
  widgets: IWidget[],
  widgetsValues: TWidgetValue[]
): TWidgetValue[] {
  const widgetNames = new Set(widgets.map((w) => w.name))
  const originalWidgetsInputs = Object.values(inputDefs).filter(
    (input) => widgetNames.has(input.name) || input.forceInput
  )

  if (originalWidgetsInputs.length === widgetsValues?.length) {
    return _.zip(originalWidgetsInputs, widgetsValues)
      .filter(([input]) => !input?.forceInput)
      .map(([_, value]) => value as TWidgetValue)
  }
  return widgetsValues
}
