import type {
  LGraph,
  LGraphNode,
  LLink,
  ResolvedConnection,
  SubgraphInputNode,
  SubgraphOutputNode
} from '@/lib/litegraph/src/types/entityRegistry'
import type { SlotDirection } from '@/types/slotId'

import type { Point } from '@/lib/litegraph/src/interfaces'
import { inputLinkId } from '@/lib/litegraph/src/node/slotLinks'

type LinkEndNode =
  | { readonly kind: 'node'; readonly node: LGraphNode }
  | { readonly kind: 'subgraphInputs'; readonly node: SubgraphInputNode }
  | { readonly kind: 'subgraphOutputs'; readonly node: SubgraphOutputNode }

/** One end of a link: its node, and the index and position of the socket it attaches to. */
export type LinkEnd = LinkEndNode & {
  readonly slot: number
  readonly position: Point
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
    position: inputNode.getInputPos(slot)
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
    position: outputNode.getOutputPos(slot)
  }
}

/** The given side of a link, when the socket on that side holds the link. */
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
