import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  useCommandTerminalTab,
  useLogsTerminalTab
} from '@/composables/bottomPanelTabs/useTerminalTabs'
import { useCommandStore } from '@/stores/commandStore'
import { ComfyExtension } from '@/types/comfy'
import type { BottomPanelExtension } from '@/types/extensionTypes'
import { isElectron } from '@/utils/envUtil'

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
  const activeBottomPanelTabId = ref<string>('')
  const activeBottomPanelTab = computed<BottomPanelExtension | null>(() => {
    return (
      bottomPanelTabs.value.find(
        (tab) => tab.id === activeBottomPanelTabId.value
      ) ?? null
    )
  })
  const setActiveTab = (tabId: string) => {
    activeBottomPanelTabId.value = tabId
  }
  const toggleBottomPanelTab = (tabId: string) => {
    if (activeBottomPanelTabId.value === tabId && bottomPanelVisible.value) {
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
      label: `Toggle ${tab.title} Bottom Panel`,
      function: () => toggleBottomPanelTab(tab.id)
    })
  }

  const registerCoreBottomPanelTabs = () => {
    registerBottomPanelTab(useLogsTerminalTab())
    if (isElectron()) {
      registerBottomPanelTab(useCommandTerminalTab())
    }
  }

  const registerExtensionBottomPanelTabs = (extension: ComfyExtension) => {
    if (extension.bottomPanelTabs) {
      extension.bottomPanelTabs.forEach(registerBottomPanelTab)
    }
  }

  return {
    bottomPanelVisible,
    toggleBottomPanel,
    bottomPanelTabs,
    activeBottomPanelTab,
    activeBottomPanelTabId,
    setActiveTab,
    toggleBottomPanelTab,
    registerBottomPanelTab,
    registerCoreBottomPanelTabs,
    registerExtensionBottomPanelTabs
  }
})
