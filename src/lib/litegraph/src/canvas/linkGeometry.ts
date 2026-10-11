import type { LGraph } from '../LGraph'
import type { LLink } from '../LLink'
import type { Point } from '../interfaces'
import { LiteGraph } from '../litegraph'
import { inputLinkId } from '../node/slotLinks'
import { getSlotPosition } from '@/renderer/core/canvas/litegraph/slotCalculations'

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

    const endPos = LiteGraph.vueNodesMode
      ? getSlotPosition(inputNode, link.target_slot, true)
      : inputNode.getInputPos(link.target_slot)
    return [subgraphInput.pos, endPos]
  }

  const { subgraphOutput, outputNode, output } = resolved
  if (subgraphOutput) {
    if (!outputNode || !output || subgraphOutput.linkIds[0] !== link.id) {
      return
    }

    const startPos = LiteGraph.vueNodesMode
      ? getSlotPosition(outputNode, link.origin_slot, false)
      : outputNode.getOutputPos(link.origin_slot)
    return [startPos, subgraphOutput.pos]
  }

  if (
    !inputNode ||
    !input ||
    inputLinkId(graph, inputNode.id, link.target_slot) !== link.id
  )
    return
  if (!outputNode || !output) return

  const endPos: Point = LiteGraph.vueNodesMode
    ? getSlotPosition(inputNode, link.target_slot, true)
    : inputNode.getInputPos(link.target_slot)
  const startPos: Point = LiteGraph.vueNodesMode
    ? getSlotPosition(outputNode, link.origin_slot, false)
    : outputNode.getOutputPos(link.origin_slot)

  return [startPos, endPos]
}
