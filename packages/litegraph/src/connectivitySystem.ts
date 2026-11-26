import type {
  LGraph,
  LGraphNode,
  Reroute
} from '@comfyorg/graph-model/entityRegistry'
import {
  LGraphEventMode,
  NodeSlotType
} from '@comfyorg/graph-model/globalEnums'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { RerouteId } from '@comfyorg/graph-model/rerouteId'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@comfyorg/graph-model/slots'

import { SUBGRAPH_INPUT_ID, SUBGRAPH_OUTPUT_ID } from './constants'
import { linkIdReservations, mintLinkId } from './idAllocation'
import { NullGraphError } from './infrastructure/NullGraphError'
import { LLink, replaceLinkTopology, slotFloatingLinks } from './LLink'
import { LiteGraph } from './litegraphInstance'
import { NodeOutputSlot } from './node/NodeOutputSlot'
import {
  finalizeInputLinkRemoval,
  inputLink,
  inputLinkId,
  outputHasLinks,
  outputLinks
} from './node/slotLinks'
import { anchorRerouteChain } from './Reroute'
import { isSubgraph } from './subgraph/subgraphTypeGuards'
import { legacyArrayItem } from './utils/collections'
import { commonType } from './utils/type'

export function connect(
  node: LGraphNode,
  slot: number | string,
  target_node: LGraphNode | number | null,
  target_slot: number | string,
  afterRerouteId?: RerouteId
): LLink | null {
  let targetIndex: number | null

  const { graph, outputs } = node
  if (!graph) {
    console.error(
      "Connect: Error, node doesn't belong to any graph. Nodes must be added first to a graph before connecting them."
    )
    return null
  }

  if (typeof slot === 'string') {
    slot = node.findOutputSlot(slot)
    if (slot == -1) {
      if (LiteGraph.debug)
        console.error(`Connect: Error, no slot of name ${slot}`)
      return null
    }
  } else if (slot >= outputs.length) {
    if (LiteGraph.debug) console.error('Connect: Error, slot number not found')
    return null
  }

  if (typeof target_node === 'number') {
    const nodeById = graph.getNodeById(toNodeId(target_node))
    if (!nodeById) throw 'target node is null'

    target_node = nodeById
  }
  if (!target_node) throw 'target node is null'

  if (target_node == node) return null

  if (typeof target_slot === 'string') {
    targetIndex = target_node.findInputSlot(target_slot)
    if (targetIndex == -1) {
      if (LiteGraph.debug)
        console.error(`Connect: Error, no slot of name ${targetIndex}`)
      return null
    }
  } else if (target_slot === LiteGraph.EVENT) {
    if (LiteGraph.do_add_triggers_slots) {
      target_node.changeMode(LGraphEventMode.ON_TRIGGER)
      targetIndex = target_node.findInputSlot('onTrigger')
    } else {
      return null
    }
  } else if (typeof target_slot === 'number') {
    targetIndex = target_slot
  } else {
    targetIndex = 0
  }

  if (target_node.onBeforeConnectInput) {
    const requestedIndex = target_node.onBeforeConnectInput(
      targetIndex,
      target_slot
    )
    targetIndex = typeof requestedIndex === 'number' ? requestedIndex : null
  }

  if (targetIndex === null || targetIndex >= target_node.inputs.length) {
    if (LiteGraph.debug) console.error('Connect: Error, slot number not found')
    return null
  }

  const input = target_node.inputs[targetIndex]
  const output = legacyArrayItem(outputs, slot)

  if (!output) return null

  if (outputHasLinks(graph, node.id, slot)) {
    if (
      output.type === LiteGraph.EVENT &&
      !LiteGraph.allow_multi_output_for_events
    ) {
      graph.beforeChange()
      node.disconnectOutput(slot)
    }
  }

  const link = node.connectSlots(output, target_node, input, afterRerouteId)
  return link ?? null
}

export function connectFloatingReroute(
  node: LGraphNode,
  pos: Point,
  slot: INodeInputSlot | INodeOutputSlot,
  afterRerouteId?: RerouteId
): Reroute | undefined {
  const { graph, id } = node
  if (!graph) throw new NullGraphError()

  const inputIndex = node.inputs.indexOf(slot)
  const outputIndex = node.outputs.indexOf(slot)
  if (inputIndex === -1 && outputIndex === -1) {
    console.error('Invalid slot')
    return
  }

  const slotType = outputIndex === -1 ? 'input' : 'output'

  const reroute = graph.setReroute({
    pos,
    parentId: afterRerouteId,
    linkIds: [],
    floating: { slotType }
  })
  if (!reroute) return

  const parentReroute = graph.getReroute(afterRerouteId)
  const fromLastFloatingReroute = parentReroute?.floating?.slotType === 'output'

  if (afterRerouteId == null || !fromLastFloatingReroute) {
    const link = new LLink(
      toLinkId(-1),
      slot.type,
      outputIndex === -1 ? -1 : id,
      outputIndex,
      inputIndex === -1 ? -1 : id,
      inputIndex
    )
    link.parentId = reroute.id
    graph.addFloatingLink(link)
    return reroute
  }

  const link = parentReroute.getFloatingLinks('output')?.[0]
  if (!link) throw new Error('[connectFloatingReroute] Floating link not found')

  link.parentId = reroute.id
  parentReroute.floating = undefined
  return reroute
}

export function connectSlots(
  graph: LGraph,
  outputNode: LGraphNode,
  output: INodeOutputSlot,
  inputNode: LGraphNode,
  input: INodeInputSlot,
  afterRerouteId: RerouteId | undefined
): LLink | null | undefined {
  const outputIndex = outputNode.outputs.indexOf(output)
  if (outputIndex === -1) {
    console.warn('connectSlots: output not found')
    return
  }
  const inputIndex = inputNode.inputs.indexOf(input)
  if (inputIndex === -1) {
    console.warn('connectSlots: input not found')
    return
  }

  if (!LiteGraph.isValidConnection(output.type, input.type)) {
    outputNode.setDirtyCanvas(false, true)
    return null
  }

  if (
    inputNode.onConnectInput?.(
      inputIndex,
      output.type,
      output,
      outputNode,
      outputIndex
    ) === false
  )
    return null
  if (
    outputNode.onConnectOutput?.(
      outputIndex,
      input.type,
      input,
      inputNode,
      inputIndex
    ) === false
  )
    return null

  const replacingLink = inputLink(graph, inputNode.id, inputIndex)
  if (replacingLink) {
    graph.beforeChange()
  }

  const maybeCommonType =
    input.type && output.type && commonType(input.type, output.type)

  const linkId = mintLinkId(graph.state, linkIdReservations(graph.rootGraph))

  const link = new LLink(
    linkId,
    maybeCommonType || input.type || output.type,
    outputNode.id,
    outputIndex,
    inputNode.id,
    inputIndex,
    afterRerouteId
  )

  if (!replaceLinkTopology(graph, replacingLink, link)) {
    if (replacingLink) graph.afterChange()
    return
  }
  graph._addLink(link)

  if (replacingLink) {
    finalizeInputLinkRemoval(
      inputNode,
      input,
      inputIndex,
      replacingLink,
      true,
      afterRerouteId
    )
    if (graph.getLink(link.id) !== link) {
      graph.afterChange()
      return
    }
  }

  anchorRerouteChain(graph, link)
  graph.incrementVersion()

  outputNode.onConnectionsChange?.(
    NodeSlotType.OUTPUT,
    outputIndex,
    true,
    link,
    output
  )
  if (graph.getLink(link.id) !== link) {
    graph.afterChange()
    return
  }

  inputNode.onConnectionsChange?.(
    NodeSlotType.INPUT,
    inputIndex,
    true,
    link,
    input
  )
  if (graph.getLink(link.id) !== link) {
    graph.afterChange()
    return
  }

  outputNode.setDirtyCanvas(false, true)
  graph.afterChange()

  return link
}

export function disconnectOutput(
  node: LGraphNode,
  slot: string | number,
  target_node?: LGraphNode
): boolean {
  if (typeof slot === 'string') {
    slot = node.findOutputSlot(slot)
    if (slot == -1) {
      if (LiteGraph.debug)
        console.error(`Connect: Error, no slot of name ${slot}`)
      return false
    }
  } else if (slot >= node.outputs.length) {
    if (LiteGraph.debug) console.error('Connect: Error, slot number not found')
    return false
  }

  const output = legacyArrayItem(node.outputs, slot)
  if (!output) return false

  let removedFloating = false
  if (!target_node && node.graph) {
    for (const link of slotFloatingLinks(node.graph, 'output', node.id, slot)) {
      node.graph.removeFloatingLink(link)
      removedFloating = true
    }
  }

  const graph = node.graph
  if (!graph) return false
  if (!outputHasLinks(graph, node.id, slot) && !removedFloating) return false

  const onlyTarget =
    typeof target_node === 'number'
      ? graph.getNodeById(target_node)
      : target_node
  if (target_node && !onlyTarget) throw 'Target Node not found'
  let disconnected = false
  for (const link_info of outputLinks(graph, node.id, slot)) {
    if (onlyTarget && link_info.target_id != onlyTarget.id) continue

    if (!disconnected && output instanceof NodeOutputSlot) {
      output._setLegacyLinksPresent(Boolean(onlyTarget))
    }
    disconnected = true

    if (link_info.target_id === SUBGRAPH_OUTPUT_ID && isSubgraph(graph)) {
      const targetSlot = legacyArrayItem(
        graph.outputNode.slots,
        link_info.target_slot
      )
      if (targetSlot) {
        targetSlot.linkIds.length = 0
      } else {
        console.error('Missing subgraphOutput slot when disconnecting link')
      }
    }

    const target = graph.getNodeById(link_info.target_id)
    const input = target?.inputs[link_info.target_slot]

    link_info.disconnect(graph, 'input')
    graph.incrementVersion()

    if (target && input) {
      target.onConnectionsChange?.(
        NodeSlotType.INPUT,
        link_info.target_slot,
        false,
        link_info,
        input
      )
    }
    node.onConnectionsChange?.(
      NodeSlotType.OUTPUT,
      slot,
      false,
      link_info,
      output
    )

    if (onlyTarget) break
  }

  if (!disconnected && !removedFloating) return false

  node.setDirtyCanvas(false, true)
  return true
}

export function disconnectInput(
  node: LGraphNode,
  slot: number | string,
  {
    keepReroutes,
    keepFloatingReroute
  }: { keepReroutes?: boolean; keepFloatingReroute?: RerouteId }
): boolean {
  if (typeof slot === 'string') {
    slot = node.findInputSlot(slot)
    if (slot == -1) {
      if (LiteGraph.debug)
        console.error(`Connect: Error, no slot of name ${slot}`)
      return false
    }
  } else if (slot >= node.inputs.length) {
    if (LiteGraph.debug) {
      console.error('Connect: Error, slot number not found')
    }
    return false
  }

  const input = legacyArrayItem(node.inputs, slot)
  if (!input) {
    console.error('disconnectInput: input not found', slot, node.inputs)
    return false
  }

  const { graph } = node
  if (!graph) throw new NullGraphError()

  for (const link of slotFloatingLinks(graph, 'input', node.id, slot)) {
    if (
      keepFloatingReroute !== undefined &&
      link.parentId === keepFloatingReroute
    )
      continue
    graph.removeFloatingLink(link)
  }

  const link_id = inputLinkId(graph, node.id, slot) ?? null
  if (link_id !== null) {
    const link_info = graph.links.get(link_id)
    if (link_info) {
      if (link_info.origin_id === SUBGRAPH_INPUT_ID && 'inputNode' in graph) {
        graph.inputNode._disconnectNodeInput(node, input, link_info)
        return true
      }

      const target_node = graph.getNodeById(link_info.origin_id)
      if (!target_node) {
        console.error(
          'disconnectInput: output not found',
          link_info.origin_slot
        )
        return false
      }

      const output = legacyArrayItem(target_node.outputs, link_info.origin_slot)
      if (!output) {
        return false
      }

      link_info.disconnect(graph, keepReroutes ? 'output' : undefined)
      graph.incrementVersion()

      node.onConnectionsChange?.(
        NodeSlotType.INPUT,
        slot,
        false,
        link_info,
        input
      )
      target_node.onConnectionsChange?.(
        NodeSlotType.OUTPUT,
        link_info.origin_slot,
        false,
        link_info,
        output
      )
    }
  }

  node.setDirtyCanvas(false, true)
  return true
}
