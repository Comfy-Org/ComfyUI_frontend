import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Positionable } from '@/lib/litegraph/src/interfaces'

export const useNodeSelectionStore = defineStore('nodeSelection', () => {
  const selectedItemIds = ref<Set<string>>(new Set())
  const version = ref(0)

  function syncFromCanvas(items: Iterable<Positionable>): void {
    const newIds = new Set<string>()
    for (const item of items) {
      if (item.id !== undefined) {
        newIds.add(String(item.id))
      }
    }

    const current = selectedItemIds.value
    if (
      newIds.size !== current.size ||
      ![...newIds].every((id) => current.has(id))
    ) {
      selectedItemIds.value = newIds
      version.value++
    }
  }

  function clear(): void {
    if (selectedItemIds.value.size > 0) {
      selectedItemIds.value = new Set()
      version.value++
    }
  }

  function isSelected(nodeId: string): boolean {
    return selectedItemIds.value.has(nodeId)
  }

  const selectedNodeIds = computed(() => selectedItemIds.value)
  const selectionCount = computed(() => selectedItemIds.value.size)
  const hasSelection = computed(() => selectedItemIds.value.size > 0)

  return {
    selectedItemIds,
    selectedNodeIds,
    selectionCount,
    hasSelection,
    version,
    syncFromCanvas,
    clear,
    isSelected
  }
})
