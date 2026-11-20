import type { LGraph, LLink } from '@comfyorg/graph-model/entityRegistry'

import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { inputLinkId } from '@/lib/litegraph/src/node/slotLinks'

export function getLinkEndpointPositions(
  graph: LGraph,
  link: LLink
): [Point, Point] | undefined {
  const resolved = link.resolve(graph)
  const { subgraphInput, inputNode, input } = resolved
  if (subgraphInput) {
    if (!inputNode || !input || !subgraphInput.linkIds.includes(link.id)) {
      return
    }
    return [subgraphInput.pos, inputNode.getInputPos(link.target_slot)]
  }

  const { subgraphOutput, outputNode, output } = resolved
  if (subgraphOutput) {
    if (!outputNode || !output || subgraphOutput.linkIds[0] !== link.id) {
      return
    }
    return [outputNode.getOutputPos(link.origin_slot), subgraphOutput.pos]
  }

  if (
    !inputNode ||
    !input ||
    inputLinkId(graph, inputNode.id, link.target_slot) !== link.id
  )
    return
  if (!outputNode || !output) return

  return [
    outputNode.getOutputPos(link.origin_slot),
    inputNode.getInputPos(link.target_slot)
  ]
}
