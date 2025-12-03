import { defineStore } from 'pinia'
import { ref } from 'vue'

type RightSidePanelTab = 'parameters' | 'settings' | 'info' | 'subgraph'

/**
 * Store for managing the right side panel state.
 * This panel displays properties and settings for selected nodes.
 */
export const useRightSidePanelStore = defineStore('rightSidePanel', () => {
  // Panel visibility state
  const isOpen = ref(false)
  const isEditingSubgraph = ref(false)

  // Active tab in the node properties panel
  const activeTab = ref<RightSidePanelTab>('parameters')

  // Actions
  function openPanel(tab?: RightSidePanelTab) {
    isOpen.value = true
    if (tab === 'subgraph') {
      activeTab.value = 'parameters'
      isEditingSubgraph.value = true
    } else if (tab) {
      activeTab.value = tab
      isEditingSubgraph.value = false
    }
  }

  function closePanel() {
    isOpen.value = false
    isEditingSubgraph.value = false
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
