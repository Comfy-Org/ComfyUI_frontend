import type {
  LGraph,
  LGraphNode,
  LLink,
  ResolvedConnection,
  SubgraphInputNode,
  SubgraphOutputNode
} from '@comfyorg/graph-model/entityRegistry'
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

function outputEnd({
  link,
  outputNode,
  output,
  subgraphInput
}: ResolvedConnection): LinkEnd | undefined {
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
  if (!outputNode || !output) return
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
  return side === 'input' ? inputEnd(graph, resolved) : outputEnd(resolved)
}

export function getLinkEndpointPositions(
  graph: LGraph,
  link: LLink
): [Point, Point] | undefined {
  const resolved = link.resolve(graph)
  const start = outputEnd(resolved)
  const end = inputEnd(graph, resolved)
  return start && end && [start.position, end.position]
}
