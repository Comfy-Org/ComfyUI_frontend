import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type RightSidePanelTab = 'parameters' | 'settings' | 'info' | 'subgraph'

/**
 * Store for managing the right side panel state.
 * This panel displays properties and settings for selected nodes.
 */
export const useRightSidePanelStore = defineStore('rightSidePanel', () => {
  const isOpen = ref(false)
  const activeTab = ref<RightSidePanelTab>('parameters')
  const isEditingSubgraph = computed(() => activeTab.value === 'subgraph')

  function openPanel(tab?: RightSidePanelTab) {
    isOpen.value = true
    if (tab) {
      activeTab.value = tab
    }
  }

  function closePanel() {
    isOpen.value = false
  }

  function togglePanel() {
    isOpen.value = !isOpen.value
  }

  return {
    isOpen,
    activeTab,
    isEditingSubgraph,
    openPanel,
    closePanel,
    togglePanel
  }
})
