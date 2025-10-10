import { defineStore } from 'pinia'
import { markRaw } from 'vue'

type SlotEntry = {
  el: HTMLElement
  index: number
  type: 'input' | 'output'
  cachedOffset?: { x: number; y: number }
}

type NodeEntry = {
  nodeId: string
  slots: { input: Map<number, SlotEntry>; output: Map<number, SlotEntry> }
  stopWatch?: () => void
}

export const useNodeSlotRegistryStore = defineStore('nodeSlotRegistry', () => {
  const registry = markRaw(new Map<string, NodeEntry>())

  function getNode(nodeId: string) {
    return registry.get(nodeId)
  }

  function ensureNode(nodeId: string) {
    let node = registry.get(nodeId)
    if (!node) {
      node = {
        nodeId,
        slots: markRaw({
          input: new Map<number, SlotEntry>(),
          output: new Map<number, SlotEntry>()
        })
      }
      registry.set(nodeId, node)
    }
    return node
  }

  function deleteNode(nodeId: string) {
    registry.delete(nodeId)
  }

  function clear() {
    registry.clear()
  }

  return {
    getNode,
    ensureNode,
    deleteNode,
    clear
  }
})
