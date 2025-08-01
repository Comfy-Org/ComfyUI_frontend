import { ColorOption, LGraph, Reroute } from '@comfyorg/litegraph'
import { LGraphGroup, LGraphNode, isColorable } from '@comfyorg/litegraph'
import type {
  ExportedSubgraph,
  ISerialisableNodeInput,
  ISerialisedGraph
} from '@comfyorg/litegraph/dist/types/serialisation'
import type {
  IBaseWidget,
  IComboWidget
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
  // @ts-expect-error Combo widget values may be a dictionary or legacy function type
  if (!widget.options.values.includes(value)) {
    // @ts-expect-error Combo widget values may be a dictionary or legacy function type
    widget.options.values.push(value)
  }
}

export const isLGraphNode = (item: unknown): item is LGraphNode => {
  return item instanceof LGraphNode
}

export const isLGraphGroup = (item: unknown): item is LGraphGroup => {
  return item instanceof LGraphGroup
}

export const isReroute = (item: unknown): item is Reroute => {
  return item instanceof Reroute
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
  widgets: IBaseWidget[],
  widgetsValues: TWidgetValue[]
): TWidgetValue[] {
  const widgetNames = new Set(widgets.map((w) => w.name))
  const originalWidgetsInputs = Object.values(inputDefs).filter(
    (input) => widgetNames.has(input.name) || input.forceInput
  )
  // Count the number of original widgets inputs.
  const numOriginalWidgets = _.sum(
    originalWidgetsInputs.map((input) =>
      // If the input has control, it will have 2 widgets.
      input.control_after_generate ||
      ['seed', 'noise_seed'].includes(input.name)
        ? 2
        : 1
    )
  )

  if (numOriginalWidgets === widgetsValues?.length) {
    return _.zip(originalWidgetsInputs, widgetsValues)
      .filter(([input]) => !input?.forceInput)
      .map(([_, value]) => value as TWidgetValue)
  }
  return widgetsValues
}

/**
 * Fix link input slots after loading a graph. Because the node inputs follows
 * the node definition after 1.16, the node inputs array from previous versions,
 * might get added items in the middle, which can cause shift to link's slot index.
 * For example, the node inputs definition is:
 * "required": {
 *   "input1": ["INT", { forceInput: true }],
 *   "input2": ["MODEL", { forceInput: false }],
 *   "input3": ["MODEL", { forceInput: false }]
 * }
 *
 * previously node inputs array was:
 * [{name: 'input2'}, {name: 'input3'}, {name: 'input1'}]
 * because input1 is created as widget first, then convert to input socket after
 * input 2 and 3.
 *
 * Now, the node inputs array just follows the definition order:
 * [{name: 'input1'}, {name: 'input2'}, {name: 'input3'}]
 *
 * We need to update the slot index of corresponding links to match the new
 * node inputs array order.
 *
 * Ref: https://github.com/Comfy-Org/ComfyUI_frontend/issues/3348
 *
 * @param graph - The graph to fix links for.
 */
export function fixLinkInputSlots(graph: LGraph) {
  // Note: We can't use forEachNode here because we need access to the graph's
  // links map at each level. Links are stored in their respective graph/subgraph.
  for (const node of graph.nodes) {
    // Fix links for the current node
    for (const [inputIndex, input] of node.inputs.entries()) {
      const linkId = input.link
      if (!linkId) continue

      const link = graph.links.get(linkId)
      if (!link) continue

      link.target_slot = inputIndex
    }

    // Recursively fix links in subgraphs
    if (node.isSubgraphNode?.() && node.subgraph) {
      fixLinkInputSlots(node.subgraph)
    }
  }
}

/**
 * Compress widget input slots by removing all unconnected widget input slots.
 * This should match the serialization format of legacy widget conversion.
 *
 * @param graph - The graph to compress widget input slots for.
 * @throws If an infinite loop is detected.
 */
export function compressWidgetInputSlots(graph: ISerialisedGraph) {
  for (const node of graph.nodes) {
    node.inputs = node.inputs?.filter(matchesLegacyApi)

    for (const [inputIndex, input] of node.inputs?.entries() ?? []) {
      if (input.link) {
        const link = graph.links.find((link) => link[0] === input.link)
        if (link) {
          link[4] = inputIndex
        }
      }
    }
  }

  compressSubgraphWidgetInputSlots(graph.definitions?.subgraphs)
}

function matchesLegacyApi(input: ISerialisableNodeInput) {
  return !(input.widget && input.link === null)
}

/**
 * Duplication to handle the legacy link arrays in the root workflow.
 * @see compressWidgetInputSlots
 * @param subgraph The subgraph to compress widget input slots for.
 */
function compressSubgraphWidgetInputSlots(
  subgraphs: ExportedSubgraph[] | undefined,
  visited = new WeakSet<ExportedSubgraph>()
) {
  if (!subgraphs) return

  for (const subgraph of subgraphs) {
    if (visited.has(subgraph)) throw new Error('Infinite loop detected')
    visited.add(subgraph)

    if (subgraph.nodes) {
      for (const node of subgraph.nodes) {
        node.inputs = node.inputs?.filter(matchesLegacyApi)

        if (!subgraph.links) continue

        for (const [inputIndex, input] of node.inputs?.entries() ?? []) {
          if (input.link) {
            const link = subgraph.links.find((link) => link.id === input.link)
            if (link) link.target_slot = inputIndex
          }
        }
      }
    }

    compressSubgraphWidgetInputSlots(subgraph.definitions?.subgraphs, visited)
  }
}
