import { defineStore } from 'pinia'
import { markRaw } from 'vue'

import type { NodeId } from '@/types/nodeId'

type SlotEntry = {
  el: HTMLElement
  index: number
  type: 'input' | 'output'
  cachedOffset?: { x: number; y: number }
}

type NodeEntry = {
  nodeId: NodeId
  slots: Map<string, SlotEntry>
  stopWatch?: () => void
}

export const useNodeSlotRegistryStore = defineStore('nodeSlotRegistry', () => {
  const registry = markRaw(new Map<string, NodeEntry>())

  function getNode(nodeId: NodeId) {
    return registry.get(String(nodeId))
  }

  function ensureNode(nodeId: NodeId) {
    const registryKey = String(nodeId)
    let node = registry.get(registryKey)
    if (!node) {
      node = {
        nodeId,
        slots: markRaw(new Map<string, SlotEntry>())
      }
      registry.set(registryKey, node)
    }
    return node
  }

  function deleteNode(nodeId: NodeId) {
    registry.delete(String(nodeId))
  }

  function clear() {
    registry.clear()
  }

  function getNodeIds(): NodeId[] {
    return Array.from(registry.values(), ({ nodeId }) => nodeId)
  }

  return {
    getNode,
    ensureNode,
    deleteNode,
    clear,
    getNodeIds
  }
})
