import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { registerLinkTopology } from '@/lib/litegraph/src/LLink'
import {
  inputHasLink,
  outputHasLinks
} from '@/lib/litegraph/src/node/slotLinks'
import { anchorRerouteChain } from '@/lib/litegraph/src/Reroute'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

export function restoreLegacyLink(
  link: LLink,
  node: LGraphNode,
  slot: number,
  side: 'input' | 'output'
): boolean {
  const { graph } = node
  if (!graph || graph.getLink(link.id)) return false
  if (link.originIsIoNode || link.targetIsIoNode) return false
  if (
    side === 'input'
      ? !link.hasTarget(node.id, slot)
      : !link.hasOrigin(node.id, slot)
  )
    return false

  const outputNode = graph.getNodeById(link.origin_id)
  const inputNode = graph.getNodeById(link.target_id)
  const output = outputNode?.outputs[link.origin_slot]
  const input = inputNode?.inputs[link.target_slot]
  if (!outputNode || !inputNode || !output || !input) return false
  if (inputHasLink(graph, inputNode.id, link.target_slot)) return false
  if (
    output.type === LiteGraph.EVENT &&
    !LiteGraph.allow_multi_output_for_events &&
    outputHasLinks(graph, outputNode.id, link.origin_slot)
  )
    return false
  if (!LiteGraph.isValidConnection(output.type, input.type)) return false
  if (
    inputNode.onConnectInput?.(
      link.target_slot,
      output.type,
      output,
      outputNode,
      link.origin_slot
    ) === false ||
    outputNode.onConnectOutput?.(
      link.origin_slot,
      input.type,
      input,
      inputNode,
      link.target_slot
    ) === false
  )
    return false

  if (link.parentId !== undefined && !graph.reroutes.has(link.parentId)) {
    link.parentId = undefined
  }
  if (!registerLinkTopology(graph, link)) return false

  anchorRerouteChain(graph, link)
  graph.incrementVersion()
  outputNode.onConnectionsChange?.(
    NodeSlotType.OUTPUT,
    link.origin_slot,
    true,
    link,
    output
  )
  if (graph.getLink(link.id) !== link) {
    graph.afterChange()
    return false
  }
  inputNode.onConnectionsChange?.(
    NodeSlotType.INPUT,
    link.target_slot,
    true,
    link,
    input
  )
  if (graph.getLink(link.id) !== link) {
    graph.afterChange()
    return false
  }

  outputNode.setDirtyCanvas(false, true)
  graph.afterChange()
  return true
}
