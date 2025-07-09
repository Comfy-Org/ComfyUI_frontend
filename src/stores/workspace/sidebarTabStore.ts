import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useModelLibrarySidebarTab } from '@/composables/sidebarTabs/useModelLibrarySidebarTab'
import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import { useQueueSidebarTab } from '@/composables/sidebarTabs/useQueueSidebarTab'
import { useWorkflowsSidebarTab } from '@/composables/sidebarTabs/useWorkflowsSidebarTab'
import { t, te } from '@/i18n'
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

    // Generate label in format "Toggle X Sidebar"
    const labelFunction = () => {
      const tabTitle = te(tab.title) ? t(tab.title) : tab.title
      return `Toggle ${tabTitle} Sidebar`
    }
    const tooltipFunction = tab.tooltip
      ? te(String(tab.tooltip))
        ? () => t(String(tab.tooltip))
        : String(tab.tooltip)
      : undefined

    useCommandStore().registerCommand({
      id: `Workspace.ToggleSidebarTab.${tab.id}`,
      icon: tab.icon,
      label: labelFunction,
      tooltip: tooltipFunction,
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
