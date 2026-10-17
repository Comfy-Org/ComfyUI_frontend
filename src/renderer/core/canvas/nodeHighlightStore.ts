import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeId } from '@/types/nodeId'

export const useNodeHighlightStore = defineStore('nodeHighlight', () => {
  const highlightedNodeIds = ref<Set<NodeId>>(new Set())

  const setHighlightedNodeIds = (ids: Iterable<NodeId>) => {
    highlightedNodeIds.value = new Set(ids)
  }

  const isHighlighted = (id: NodeId) => highlightedNodeIds.value.has(id)

  return { highlightedNodeIds, setHighlightedNodeIds, isHighlighted }
})
