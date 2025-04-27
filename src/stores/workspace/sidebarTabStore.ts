import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useModelLibrarySidebarTab } from '@/composables/sidebarTabs/useModelLibrarySidebarTab'
import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import { useQueueSidebarTab } from '@/composables/sidebarTabs/useQueueSidebarTab'
import { useWorkflowsSidebarTab } from '@/composables/sidebarTabs/useWorkflowsSidebarTab'
import { useCommandStore } from '@/stores/commandStore'
import { SidebarTabExtension } from '@/types/extensionTypes'

export const useSidebarTabStore = defineStore('sidebarTab', () => {
  const sidebarTabs = ref<SidebarTabExtension[]>([])
  const activeSidebarTabId = ref<string | null>(null)

  const activeSidebarTab = computed<SidebarTabExtension | null>(() => {
    return (
      sidebarTabs.value.find((tab) => tab.id === activeSidebarTabId.value) ??
      null
    )
  })

  const toggleSidebarTab = (tabId: string) => {
    activeSidebarTabId.value = activeSidebarTabId.value === tabId ? null : tabId
  }

  const registerSidebarTab = (tab: SidebarTabExtension) => {
    sidebarTabs.value = [...sidebarTabs.value, tab]
    useCommandStore().registerCommand({
      id: `Workspace.ToggleSidebarTab.${tab.id}`,
      icon: tab.icon,
      label: `Toggle ${tab.title} Sidebar`,
      tooltip: tab.tooltip,
      versionAdded: '1.3.9',
      function: () => {
        toggleSidebarTab(tab.id)
      },
      source: 'System'
    })
  }

  const unregisterSidebarTab = (id: string) => {
    const index = sidebarTabs.value.findIndex((tab) => tab.id === id)
    if (index !== -1) {
      const tab = sidebarTabs.value[index]
      if (tab.type === 'custom' && tab.destroy) {
        tab.destroy()
      }
      const newSidebarTabs = [...sidebarTabs.value]
      newSidebarTabs.splice(index, 1)
      sidebarTabs.value = newSidebarTabs
    }
  }

  /**
   * Register the core sidebar tabs.
   */
  const registerCoreSidebarTabs = () => {
    registerSidebarTab(useQueueSidebarTab())
    registerSidebarTab(useNodeLibrarySidebarTab())
    registerSidebarTab(useModelLibrarySidebarTab())
    registerSidebarTab(useWorkflowsSidebarTab())
  }

  return {
    sidebarTabs,
    activeSidebarTabId,
    activeSidebarTab,
    toggleSidebarTab,
    registerSidebarTab,
    unregisterSidebarTab,
    registerCoreSidebarTabs
  }
})
