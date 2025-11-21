import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

/**
 * Store for managing the right side panel state.
 * This panel displays properties and settings for selected nodes.
 */
export const useRightSidePanelStore = defineStore('rightSidePanel', () => {
  const canvasStore = useCanvasStore()

  // Panel visibility state - persisted in localStorage
  const isOpen = ref(false)

  // Active tab in the panel
  type PanelTab = 'properties' | 'subgraph'
  const activeTab = ref<PanelTab>('properties')

  // Computed: should show properties tab
  const showPropertiesTab = computed(() => {
    return canvasStore.selectedItems.length > 0
  })

  // Computed: should show subgraph tab
  const showSubgraphTab = computed(() => {
    const selectedNodes = canvasStore.selectedItems
    return (
      selectedNodes.length === 1 &&
      'isSubgraphNode' in selectedNodes[0] &&
      typeof selectedNodes[0].isSubgraphNode === 'function' &&
      selectedNodes[0].isSubgraphNode()
    )
  })

  // Auto-switch to properties tab when selecting non-subgraph nodes
  watch(
    () => canvasStore.selectedItems,
    () => {
      if (!showSubgraphTab.value && activeTab.value === 'subgraph') {
        activeTab.value = 'properties'
      }
    }
  )

  // Actions
  function openPanel() {
    isOpen.value = true
  }

  function closePanel() {
    isOpen.value = false
  }

  function togglePanel() {
    isOpen.value = !isOpen.value
  }

  function setActiveTab(tab: PanelTab) {
    activeTab.value = tab
  }

  return {
    isOpen,
    activeTab,
    showPropertiesTab,
    showSubgraphTab,
    openPanel,
    closePanel,
    togglePanel,
    setActiveTab
  }
})
