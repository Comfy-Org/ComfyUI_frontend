import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t, te } from '@/i18n'
import { openModelLibraryBrowser } from '@/platform/assets/composables/openModelLibraryBrowser'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

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

  const registerSidebarTab = (
    tab: SidebarTabExtension,
    options?: { prepend?: boolean }
  ) => {
    sidebarTabs.value = options?.prepend
      ? [tab, ...sidebarTabs.value]
      : [...sidebarTabs.value, tab]

    // Generate label in format "Toggle X Sidebar"
    const labelFunction = () => {
      const tabTitle = te(tab.title) ? t(tab.title) : tab.title
      return `Toggle ${tabTitle} Sidebar`
    }
    const tooltipFunction = tab.tooltip
      ? te(tab.tooltip)
        ? () => t(String(tab.tooltip))
        : tab.tooltip
      : undefined

    const menubarLabelFunction = () => {
      const menubarLabelKeys: Record<string, string> = {
        'node-library': 'sideToolbar.nodeLibrary',
        'model-library': 'sideToolbar.modelLibrary',
        workflows: 'sideToolbar.workflows',
        assets: 'sideToolbar.assets',
        'job-history': 'queue.jobHistory'
      }

      const key = menubarLabelKeys[tab.id]
      if (key && te(key)) {
        return t(key)
      }

      return tab.title
    }

    useCommandStore().registerCommand({
      id: `Workspace.ToggleSidebarTab.${tab.id}`,
      icon: typeof tab.icon === 'string' ? tab.icon : undefined,
      label: labelFunction,
      menubarLabel: menubarLabelFunction,
      tooltip: tooltipFunction,
      versionAdded: '1.3.9',
      category: 'view-controls' as const,
      function: async () => {
        const settingStore = useSettingStore()

        // The asset browser cannot function without backend asset support, so
        // the browser routing requires both the user preference and the server
        // capability; without the capability the preference is inert and the
        // tab opens the sidebar tree.
        if (
          tab.id === 'model-library' &&
          settingStore.get('Comfy.ModelLibrary.UseAssetBrowser') &&
          useFeatureFlags().flags.assetsEnabled
        ) {
          await openModelLibraryBrowser()
          return
        }

        toggleSidebarTab(tab.id)
      },
      active: () => activeSidebarTab.value?.id === tab.id,
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
      if (activeSidebarTabId.value === id) {
        activeSidebarTabId.value = null
      }
    }
  }

  return {
    sidebarTabs,
    activeSidebarTabId,
    activeSidebarTab,
    toggleSidebarTab,
    registerSidebarTab,
    unregisterSidebarTab
  }
})
