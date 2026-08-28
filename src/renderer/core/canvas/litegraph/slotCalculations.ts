/**
 * Slot Position Calculations
 *
 * Centralized utility for calculating input/output slot positions on nodes.
 * This allows both litegraph nodes and the layout system to use the same
 * calculation logic while providing their own position data.
 */
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  Point
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { isWidgetInputSlot } from '@/lib/litegraph/src/node/slotUtils'
import { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import { nodesInRenderOrder } from '@/renderer/core/canvas/litegraph/arrangeForLegacyRender'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type {
  Point as LayoutPoint,
  SlotLayout
} from '@/renderer/core/layout/types'
import { pointInBounds } from '@/renderer/core/layout/utils/layoutMath'

export interface SlotPositionContext {
  /** Node's X position in graph coordinates */
  nodeX: number
  /** Node's Y position in graph coordinates */
  nodeY: number
  /** Node's width */
  nodeWidth: number
  /** Node's height */
  nodeHeight: number
  /** Whether the node is collapsed */
  collapsed: boolean
  /** Collapsed width (if applicable) */
  collapsedWidth?: number
  /** Node constructor's slot_start_y offset */
  slotStartY?: number
  /** Node's input slots */
  inputs: INodeInputSlot[]
  /** Node's output slots */
  outputs: INodeOutputSlot[]
  /** Node's widgets (for widget slot detection) */
  widgets?: Array<{ name?: string }>
}

/**
 * Calculate the position of an input slot in graph coordinates
 * @param context Node context containing position and slot data
 * @param slot The input slot index
 * @returns Position of the input slot center in graph coordinates
 */
function calculateInputSlotPos(
  context: SlotPositionContext,
  slot: number
): Point {
  const input = context.inputs[slot]
  if (!input) return [context.nodeX, context.nodeY]

  return calculateInputSlotPosFromSlot(context, input)
}

/**
 * Calculate the position of an input slot in graph coordinates
 * @param context Node context containing position and slot data
 * @param input The input slot object
 * @returns Position of the input slot center in graph coordinates
 */
export function calculateInputSlotPosFromSlot(
  context: SlotPositionContext,
  input: INodeInputSlot
): Point {
  const { nodeX, nodeY, collapsed } = context

  // Handle collapsed nodes
  if (collapsed) {
    const halfTitle = LiteGraph.NODE_TITLE_HEIGHT * 0.5
    return [nodeX, nodeY - halfTitle]
  }

  // Handle hard-coded positions
  const { pos } = input
  if (pos) return [nodeX + pos[0], nodeY + pos[1]]

  // Default vertical slots
  const offsetX = LiteGraph.NODE_SLOT_HEIGHT * 0.5
  const nodeOffsetY = context.slotStartY || 0
  let slotIndex = -1
  const inputIndex = context.inputs.indexOf(input)
  if (
    inputIndex !== -1 &&
    !input.pos &&
    !(context.widgets?.length && isWidgetInputSlot(input))
  ) {
    slotIndex = 0
    for (const [index, slot] of context.inputs.entries()) {
      if (index >= inputIndex) break
      if (!slot.pos && !(context.widgets?.length && isWidgetInputSlot(slot))) {
        slotIndex++
      }
    }
  }
  const slotY = (slotIndex + 0.7) * LiteGraph.NODE_SLOT_HEIGHT

  return [nodeX + offsetX, nodeY + slotY + nodeOffsetY]
}

/**
 * Calculate the position of an output slot in graph coordinates
 * @param context Node context containing position and slot data
 * @param slot The output slot index
 * @returns Position of the output slot center in graph coordinates
 */
function calculateOutputSlotPos(
  context: SlotPositionContext,
  slot: number
): Point {
  const { nodeX, nodeY, nodeWidth, collapsed, collapsedWidth, outputs } =
    context

  // Handle collapsed nodes
  if (collapsed) {
    const width = collapsedWidth || LiteGraph.NODE_COLLAPSED_WIDTH
    const halfTitle = LiteGraph.NODE_TITLE_HEIGHT * 0.5
    return [nodeX + width, nodeY - halfTitle]
  }

  const outputSlot = outputs[slot]
  if (!outputSlot) return [nodeX + nodeWidth, nodeY]

  // Handle hard-coded positions
  const outputPos = outputSlot.pos
  if (outputPos) return [nodeX + outputPos[0], nodeY + outputPos[1]]

  // Default vertical slots
  const offsetX = LiteGraph.NODE_SLOT_HEIGHT * 0.5
  const nodeOffsetY = context.slotStartY || 0
  const defaultVerticalOutputs = getDefaultVerticalOutputs(context)
  const slotIndex = defaultVerticalOutputs.indexOf(outputSlot)
  const slotY = (slotIndex + 0.7) * LiteGraph.NODE_SLOT_HEIGHT

  // TODO: Why +1?
  return [nodeX + nodeWidth + 1 - offsetX, nodeY + slotY + nodeOffsetY]
}

/**
 * Get a slot center from current node and slot geometry.
 * @param node The LGraphNode
 * @param slotIndex The slot index
 * @param isInput Whether this is an input slot
 * @returns Position of the slot center in graph coordinates
 */
export function getSlotPosition(
  node: LGraphNode,
  slotIndex: number,
  isInput: boolean
): Point {
  if (LiteGraph.vueNodesMode)
    return getVueSlotPosition(node, slotIndex, isInput)

  const context: SlotPositionContext = {
    nodeX: node.pos[0],
    nodeY: node.pos[1],
    nodeWidth: node.size[0],
    nodeHeight: node.size[1],
    collapsed: node.flags.collapsed || false,
    collapsedWidth: node._collapsed_width,
    slotStartY: node.constructor.slot_start_y,
    inputs: node.inputs,
    outputs: node.outputs,
    widgets: node.widgets
  }

  return isInput
    ? calculateInputSlotPos(context, slotIndex)
    : calculateOutputSlotPos(context, slotIndex)
}

function getVueSlotPosition(
  node: LGraphNode,
  slotIndex: number,
  isInput: boolean
): Point {
  const [nodeX, nodeY] = node.pos
  const offset = getRenderedSlotOffset(node, slotIndex, isInput)
  if (offset) return [nodeX + offset.x, nodeY + offset.y]

  const nodeWidth = node.flags.collapsed
    ? (node._collapsed_width ?? LiteGraph.NODE_COLLAPSED_WIDTH)
    : node.renderingSize[0]
  return calculateVueSlotPosition(
    node,
    slotIndex,
    isInput,
    nodeX,
    nodeY,
    nodeWidth
  )
}

function getRenderedSlotOffset(
  node: LGraphNode,
  slotIndex: number,
  isInput: boolean
): LayoutPoint | null {
  if (!node.graph) return null
  return layoutStore.getSlotOffset(
    node.graph.rootGraph.id,
    node.id,
    slotIndex,
    isInput ? 'input' : 'output',
    node.flags.collapsed ? 'collapsed' : 'expanded'
  )
}

function calculateVueSlotPosition(
  node: LGraphNode,
  slotIndex: number,
  isInput: boolean,
  nodeX: number,
  nodeY: number,
  nodeWidth: number
): Point {
  if (node.flags.collapsed) {
    return [
      isInput ? nodeX : nodeX + nodeWidth,
      nodeY - LiteGraph.NODE_TITLE_HEIGHT * 0.5
    ]
  }

  return isInput
    ? calculateVueInputSlotPosition(node, slotIndex, nodeX, nodeY)
    : calculateVueOutputSlotPosition(node, slotIndex, nodeX, nodeY, nodeWidth)
}

function calculateVueInputSlotPosition(
  node: LGraphNode,
  slotIndex: number,
  nodeX: number,
  nodeY: number
): Point {
  const input = node.inputs[slotIndex]
  if (!input) return [nodeX, nodeY]

  const widgetSlotY = getWidgetSlotY(node, input)
  if (widgetSlotY !== undefined) {
    return [nodeX, getVueNodeContentY(node, nodeY) + widgetSlotY]
  }

  const renderedIndex = node.inputs
    .slice(0, slotIndex)
    .filter((candidate) => !isWidgetInputSlot(candidate)).length
  return [
    nodeX,
    getVueNodeContentY(node, nodeY) + getVueSlotY(node, renderedIndex)
  ]
}

function getWidgetSlotY(
  node: LGraphNode,
  input: INodeInputSlot
): number | undefined {
  if (!isWidgetInputSlot(input)) return undefined
  if (input.pos) return input.pos[1]

  const widget =
    input._widget ??
    node.widgets?.find((candidate) => candidate.name === input.widget.name)
  return widget && widget.y + LiteGraph.NODE_SLOT_HEIGHT * 0.5
}

function calculateVueOutputSlotPosition(
  node: LGraphNode,
  slotIndex: number,
  nodeX: number,
  nodeY: number,
  nodeWidth: number
): Point {
  if (!node.outputs[slotIndex]) {
    return [nodeX + nodeWidth, nodeY]
  }

  return [
    nodeX + nodeWidth,
    getVueNodeContentY(node, nodeY) + getVueSlotY(node, slotIndex)
  ]
}

function getVueSlotY(node: LGraphNode, slotIndex: number): number {
  return (
    (slotIndex + (node.type === 'Reroute' ? 0.5 : 0.7)) *
    LiteGraph.NODE_SLOT_HEIGHT
  )
}

function getVueNodeContentY(node: LGraphNode, nodeY: number): number {
  return node.title_mode === TitleMode.NO_TITLE
    ? nodeY - LiteGraph.NODE_TITLE_HEIGHT
    : nodeY
}

export function getSlotLayout(
  node: LGraphNode,
  slotIndex: number,
  isInput: boolean
): SlotLayout | null {
  const slot = isInput ? node.inputs[slotIndex] : node.outputs[slotIndex]
  if (!slot) return null

  return createSlotLayout(
    node,
    slotIndex,
    isInput,
    getSlotPosition(node, slotIndex, isInput)
  )
}

function createSlotLayout(
  node: LGraphNode,
  slotIndex: number,
  isInput: boolean,
  [x, y]: Point
): SlotLayout {
  const size = LiteGraph.NODE_SLOT_HEIGHT
  const half = size * 0.5
  return {
    nodeId: node.id,
    index: slotIndex,
    type: isInput ? 'input' : 'output',
    position: { x, y },
    bounds: { x: x - half, y: y - half, width: size, height: size }
  }
}

export function getGraphSlotLayout(
  graph: LGraph,
  nodeId: LGraphNode['id'],
  slotIndex: number,
  isInput: boolean
): SlotLayout | null {
  const node = graph.getNodeById(nodeId)
  return node ? getSlotLayout(node, slotIndex, isInput) : null
}

export function getSlotLayoutAtPoint(
  graph: LGraph,
  point: LayoutPoint,
  node?: LGraphNode
): SlotLayout | null {
  if (node) return getNodeSlotLayoutAtPoint(node, point)
  const nodes = nodesInRenderOrder(graph)
  for (let index = nodes.length - 1; index >= 0; index--) {
    const layout = getNodeSlotLayoutAtPoint(nodes[index], point)
    if (layout) return layout
  }
  return null
}

function getNodeSlotLayoutAtPoint(
  node: LGraphNode,
  point: LayoutPoint
): SlotLayout | null {
  for (const [index] of node.inputs.entries()) {
    const layout = getSlotLayout(node, index, true)
    if (layout && pointInBounds(point, layout.bounds)) return layout
  }
  for (const [index] of node.outputs.entries()) {
    const layout = getSlotLayout(node, index, false)
    if (layout && pointInBounds(point, layout.bounds)) return layout
  }
  return null
}

/**
 * Get the outputs that are not positioned with absolute coordinates
 */
function getDefaultVerticalOutputs(
  context: SlotPositionContext
): INodeOutputSlot[] {
  return context.outputs.filter((slot) => !slot.pos)
}
