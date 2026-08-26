import { defineStore } from 'pinia'
import { markRaw } from 'vue'

import type { NodeId } from '@/types/nodeId'
import type { SlotId } from '@/types/slotId'

type SlotEntry = {
  el: HTMLElement
  index: number
  type: 'input' | 'output'
  cachedOffset?: { x: number; y: number }
}

type NodeEntry = {
  nodeId: NodeId
  slots: Map<SlotId, SlotEntry>
  active: boolean
  registrationComplete: boolean
  hasNodeOwner: boolean
  stopWatch?: () => void
}

export const useNodeSlotRegistryStore = defineStore('nodeSlotRegistry', () => {
  const registry = markRaw(new Map<NodeId, NodeEntry>())

  function getNode(nodeId: NodeId) {
    return registry.get(nodeId)
  }

  function ensureNode(nodeId: NodeId) {
    let node = registry.get(nodeId)
    if (!node) {
      node = {
        nodeId,
        slots: markRaw(new Map<SlotId, SlotEntry>()),
        active: true,
        registrationComplete: true,
        hasNodeOwner: false
      }
      registry.set(nodeId, node)
    }
    return node
  }

  function deleteNode(nodeId: NodeId) {
    registry.delete(nodeId)
  }

  function clear() {
    registry.clear()
  }

  function getNodeIds(): NodeId[] {
    return Array.from(registry.keys())
  }

  return {
    getNode,
    ensureNode,
    deleteNode,
    clear,
    getNodeIds
  }
})
