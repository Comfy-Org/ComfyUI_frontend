import { useModelLibrarySidebarTab } from '@/hooks/sidebarTabs/modelLibrarySidebarTab'
import { useNodeLibrarySidebarTab } from '@/hooks/sidebarTabs/nodeLibrarySidebarTab'
import { useQueueSidebarTab } from '@/hooks/sidebarTabs/queueSidebarTab'
import { useWorkflowsSidebarTab } from '@/hooks/sidebarTabs/workflowsSidebarTab'
import { SidebarTabExtension } from '@/types/extensionTypes'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useCommandStore } from '@/stores/commandStore'

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
      label: tab.tooltip,
      tooltip: tab.tooltip,
      versionAdded: '1.3.9',
      function: () => {
        toggleSidebarTab(tab.id)
      }
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
