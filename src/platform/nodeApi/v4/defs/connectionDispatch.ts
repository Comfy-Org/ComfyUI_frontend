import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import type { LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { isNodeSlot } from '@/lib/litegraph/src/subgraph/subgraphTypeGuards'

import type {
  BeforeConnectEvent,
  ConnectionChangeEvent
} from '@/platform/nodeApi/v4/types'
import type { Deliver, MethodInstaller } from './dispatchContext'

/** Delivers the hooks about a node's links: before one is made and after one changes. */
export function connectionInstallers(
  deliver: Deliver
): Record<string, MethodInstaller> {
  function mayConnect(
    type: string,
    node: LGraphNode,
    event: BeforeConnectEvent
  ): boolean {
    return !deliver(type, 'onBeforeConnect', node, (callback, handle) =>
      callback(handle, event)
    ).includes(false)
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
        return mayConnect(type, this, Object.freeze({ side: 'input', index }))
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
        return mayConnect(type, this, Object.freeze({ side: 'output', index }))
      }
    }
  }
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
