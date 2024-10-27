import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { SidebarTabExtension, ToastManager } from '@/types/extensionTypes'
import { useToastStore } from './toastStore'
import { useQueueSettingsStore } from './queueStore'
import { useCommandStore } from './commandStore'
import { useSidebarTabStore } from './workspace/sidebarTabStore'
import { useSettingStore } from './settingStore'

export const useWorkspaceStore = defineStore('workspace', () => {
  const spinner = ref(false)
  const shiftDown = ref(false)

  const toast = computed<ToastManager>(() => useToastStore())
  const queueSettings = computed(() => useQueueSettingsStore())
  const command = computed(() => ({
    execute: useCommandStore().execute
  }))
  const sidebarTab = computed(() => useSidebarTabStore())
  const setting = computed(() => ({
    get: useSettingStore().get,
    set: useSettingStore().set
  }))

  /**
   * Registers a sidebar tab.
   * @param tab The sidebar tab to register.
   * @deprecated Use `sidebarTab.registerSidebarTab` instead.
   */
  function registerSidebarTab(tab: SidebarTabExtension) {
    sidebarTab.value.registerSidebarTab(tab)
  }

  /**
   * Unregisters a sidebar tab.
   * @param id The id of the sidebar tab to unregister.
   * @deprecated Use `sidebarTab.unregisterSidebarTab` instead.
   */
  function unregisterSidebarTab(id: string) {
    sidebarTab.value.unregisterSidebarTab(id)
  }

  /**
   * Gets all registered sidebar tabs.
   * @returns All registered sidebar tabs.
   * @deprecated Use `sidebarTab.sidebarTabs` instead.
   */
  function getSidebarTabs(): SidebarTabExtension[] {
    return sidebarTab.value.sidebarTabs
  }

  return {
    spinner,
    shiftDown,
    toast,
    queueSettings,
    command,
    sidebarTab,
    setting,

    registerSidebarTab,
    unregisterSidebarTab,
    getSidebarTabs
  }
})
