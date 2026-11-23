import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph, LLink } from '@/lib/litegraph/src/litegraph'
import { isNodeSlot } from '@/lib/litegraph/src/subgraph/subgraphTypeGuards'

import type {
  BeforeConnectEvent,
  ConnectionChangeEvent,
  SlotSide
} from '@/platform/nodeApi/v4/types'
import type { Deliver, MethodInstaller } from './dispatchContext'

/** Delivers the hooks about a node's links: before one is made, refused if a hook moved either end, and after one changes. */
export function connectionInstallers(
  deliver: Deliver
): Record<string, MethodInstaller> {
  function mayConnect(
    type: string,
    node: LGraphNode,
    event: BeforeConnectEvent,
    peer: unknown,
    peerIndex: number
  ): boolean {
    const own = endpointOf(node, event.side, event.index)
    const other =
      peer instanceof LGraphNode
        ? endpointOf(
            peer,
            event.side === 'input' ? 'output' : 'input',
            peerIndex
          )
        : undefined
    const answers = deliver(type, 'onBeforeConnect', node, (callback, handle) =>
      callback(handle, event)
    )
    return (
      !answers.includes(false) &&
      isInPlace(own) &&
      (other === undefined || isInPlace(other))
    )
  }

  return {
    onConnectionsChange(target, type) {
      const previous = target.onConnectionsChange
      target.onConnectionsChange = function (
        slotType,
        index,
        connected,
        link,
        slot
      ) {
        previous?.call(this, slotType, index, connected, link, slot)
        if (connected && !link) return
        const input = slotType === NodeSlotType.INPUT
        const side = input ? 'input' : 'output'
        const event: ConnectionChangeEvent = Object.freeze({
          side,
          index,
          name: isNodeSlot(slot)
            ? slot.name
            : ((input ? this.inputs : this.outputs)[index]?.name ?? slot.name),
          connected,
          ...peerOf(link ?? undefined, side)
        })
        deliver(type, 'onConnectionsChanged', this, (callback, handle) =>
          callback(handle, event)
        )
      }
    },
    onConnectInput(target, type) {
      const previous = target.onConnectInput
      target.onConnectInput = function (
        index,
        peerType,
        slot,
        peer,
        peerIndex
      ) {
        if (
          previous?.call(this, index, peerType, slot, peer, peerIndex) === false
        )
          return false
        return mayConnect(
          type,
          this,
          Object.freeze({ side: 'input', index }),
          peer,
          peerIndex
        )
      }
    },
    onConnectOutput(target, type) {
      const previous = target.onConnectOutput
      target.onConnectOutput = function (
        index,
        peerType,
        slot,
        peer,
        peerIndex
      ) {
        if (
          previous?.call(this, index, peerType, slot, peer, peerIndex) === false
        )
          return false
        return mayConnect(
          type,
          this,
          Object.freeze({ side: 'output', index }),
          peer,
          peerIndex
        )
      }
    }
  }
}

interface Endpoint {
  readonly node: LGraphNode
  readonly graph: LGraph | null
  readonly side: SlotSide
  readonly index: number
  readonly slot: unknown
}

function slotsOn(node: LGraphNode, side: SlotSide) {
  return side === 'input' ? node.inputs : node.outputs
}

function endpointOf(node: LGraphNode, side: SlotSide, index: number): Endpoint {
  return {
    node,
    graph: node.graph,
    side,
    index,
    slot: slotsOn(node, side)[index]
  }
}

function isInPlace({ node, graph, side, index, slot }: Endpoint): boolean {
  return (
    graph?.getNodeById(node.id) === node && slotsOn(node, side)[index] === slot
  )
}

const NO_PEER = Object.freeze({ peerNodeId: undefined, peerIndex: undefined })

function peerOf(
  link: LLink | undefined,
  side: ConnectionChangeEvent['side']
): Pick<ConnectionChangeEvent, 'peerNodeId' | 'peerIndex'> {
  if (!link) return NO_PEER
  const [nodeId, peerIndex] =
    side === 'input'
      ? [link.origin_id, link.origin_slot]
      : [link.target_id, link.target_slot]
  return nodeId === SUBGRAPH_INPUT_ID || nodeId === SUBGRAPH_OUTPUT_ID
    ? NO_PEER
    : { peerNodeId: String(nodeId), peerIndex }
}
