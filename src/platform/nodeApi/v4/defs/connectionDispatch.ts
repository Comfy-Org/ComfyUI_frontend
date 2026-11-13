import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isNodeSlot } from '@/lib/litegraph/src/subgraph/subgraphTypeGuards'

import type {
  BeforeConnectEvent,
  ConnectionChangeEvent
} from '@/platform/nodeApi/v4/types'
import type { Deliver, MethodInstaller } from './dispatchContext'

/** Delivers the hooks about a node's links: before one is made, and after one changes. */
export function connectionInstallers(
  deliver: Deliver
): Record<string, MethodInstaller> {
  function mayConnect(
    type: string,
    node: LGraphNode,
    event: BeforeConnectEvent
  ): boolean {
    const answers = deliver(type, 'onBeforeConnect', node, (callback, handle) =>
      callback(handle, event)
    )
    return !answers.includes(false)
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
        const peerNodeId = input ? link?.origin_id : link?.target_id
        const event: ConnectionChangeEvent = Object.freeze({
          side: input ? 'input' : 'output',
          index,
          name: isNodeSlot(slot)
            ? slot.name
            : ((input ? this.inputs : this.outputs)[index]?.name ?? slot.name),
          connected,
          peerNodeId: peerNodeId === undefined ? undefined : String(peerNodeId),
          peerIndex: input ? link?.origin_slot : link?.target_slot
        })
        deliver(type, 'onConnectionsChanged', this, (callback, handle) =>
          callback(handle, event)
        )
      }
    },
    onConnectInput(target, type) {
      const previous = target.onConnectInput
      target.onConnectInput = function (index, ...rest) {
        if (previous?.call(this, index, ...rest) === false) return false
        return mayConnect(type, this, Object.freeze({ side: 'input', index }))
      }
    },
    onConnectOutput(target, type) {
      const previous = target.onConnectOutput
      target.onConnectOutput = function (index, ...rest) {
        if (previous?.call(this, index, ...rest) === false) return false
        return mayConnect(type, this, Object.freeze({ side: 'output', index }))
      }
    }
  }
}
