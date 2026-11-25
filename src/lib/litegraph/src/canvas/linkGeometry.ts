import type {
  LGraph,
  LGraphNode,
  LLink,
  ResolvedConnection,
  SubgraphInputNode,
  SubgraphOutputNode
} from '@comfyorg/graph-model/entityRegistry'
import { TitleMode } from '@comfyorg/graph-model/globalEnums'
import type { SlotDirection } from '@comfyorg/graph-model/slotId'

import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { litegraph } from '@/lib/litegraph/src/litegraphInstance'
import { inputLinkId } from '@/lib/litegraph/src/node/slotLinks'
import { getSlotPosition } from '@/renderer/core/canvas/litegraph/slotCalculations'

type LinkEndNode =
  | { readonly kind: 'node'; readonly node: LGraphNode }
  | { readonly kind: 'subgraphInputs'; readonly node: SubgraphInputNode }
  | { readonly kind: 'subgraphOutputs'; readonly node: SubgraphOutputNode }

export type LinkEnd = LinkEndNode & {
  readonly slot: number
  readonly position: Point
}

/** The live graph-space top edge drawn for the node at a link end, title included. */
export function linkEndTop(end: LinkEnd): number {
  const [, y] = end.node.pos
  const titled =
    end.kind === 'node' && end.node.title_mode !== TitleMode.NO_TITLE
  return titled ? y - litegraph().NODE_TITLE_HEIGHT : y
}

function renderedSocketPosition(
  node: LGraphNode,
  slot: number,
  side: SlotDirection
): Point {
  const isInput = side === 'input'
  if (litegraph().vueNodesMode) return getSlotPosition(node, slot, isInput)
  return isInput ? node.getInputPos(slot) : node.getOutputPos(slot)
}

function inputEnd(
  graph: LGraph,
  { link, inputNode, input, subgraphOutput }: ResolvedConnection
): LinkEnd | undefined {
  const slot = link.target_slot
  if (subgraphOutput) {
    if (subgraphOutput.linkIds[0] !== link.id) return
    return {
      kind: 'subgraphOutputs',
      node: subgraphOutput.parent,
      slot,
      position: subgraphOutput.pos
    }
  }
  if (
    !inputNode ||
    !input ||
    inputLinkId(graph, inputNode.id, slot) !== link.id
  )
    return
  return {
    kind: 'node',
    node: inputNode,
    slot,
    position: renderedSocketPosition(inputNode, slot, 'input')
  }
}

function outputEnd(
  graph: LGraph,
  { link, outputNode, output, subgraphInput }: ResolvedConnection
): LinkEnd | undefined {
  const slot = link.origin_slot
  if (subgraphInput) {
    if (!subgraphInput.linkIds.includes(link.id)) return
    return {
      kind: 'subgraphInputs',
      node: subgraphInput.parent,
      slot,
      position: subgraphInput.pos
    }
  }
  if (!outputNode || !output || graph.getLink(link.id) !== link) return
  return {
    kind: 'node',
    node: outputNode,
    slot,
    position: renderedSocketPosition(outputNode, slot, 'output')
  }
}

export function getLinkEnd(
  graph: LGraph,
  link: LLink,
  side: SlotDirection
): LinkEnd | undefined {
  const resolved = link.resolve(graph)
  return side === 'input'
    ? inputEnd(graph, resolved)
    : outputEnd(graph, resolved)
}

export function getLinkEndpointPositions(
  graph: LGraph,
  link: LLink
): [Point, Point] | undefined {
  const resolved = link.resolve(graph)
  const start = outputEnd(graph, resolved)
  const end = inputEnd(graph, resolved)
  return start && end && [start.position, end.position]
}
