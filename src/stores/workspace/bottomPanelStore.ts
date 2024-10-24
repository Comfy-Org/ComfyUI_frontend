import type { BottomPanelExtension } from '@/types/extensionTypes'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useCommandStore } from '@/stores/commandStore'

export const useBottomPanelStore = defineStore('bottomPanel', () => {
  const bottomPanelVisible = ref(false)
  const toggleBottomPanel = () => {
    // If there are no tabs, don't show the bottom panel
    if (bottomPanelTabs.value.length === 0) {
      return
    }
    bottomPanelVisible.value = !bottomPanelVisible.value
  }

  const bottomPanelTabs = ref<BottomPanelExtension[]>([])
  const activeBottomPanelTabId = ref<string | null>(null)
  const activeBottomPanelTab = computed<BottomPanelExtension | null>(() => {
    return (
      bottomPanelTabs.value.find(
        (tab) => tab.id === activeBottomPanelTabId.value
      ) ?? null
    )
  })
  const toggleBottomPanelTab = (tabId: string) => {
    if (activeBottomPanelTabId.value === tabId) {
      bottomPanelVisible.value = false
    } else {
      activeBottomPanelTabId.value = tabId
      bottomPanelVisible.value = true
    }
  }
  const registerBottomPanelTab = (tab: BottomPanelExtension) => {
    bottomPanelTabs.value = [...bottomPanelTabs.value, tab]
    if (bottomPanelTabs.value.length === 1) {
      activeBottomPanelTabId.value = tab.id
    }
    useCommandStore().registerCommand({
      id: `Workspace.ToggleBottomPanelTab.${tab.id}`,
      icon: 'pi pi-list',
      label: tab.title,
      function: () => toggleBottomPanelTab(tab.id)
    })
  }

  return {
    bottomPanelVisible,
    toggleBottomPanel,
    bottomPanelTabs,
    activeBottomPanelTab,
    toggleBottomPanelTab,
    registerBottomPanelTab
  }
})