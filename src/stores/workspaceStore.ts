import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useColorPaletteService } from '@/services/colorPaletteService'
import { useDialogService } from '@/services/dialogService'
import type { SidebarTabExtension, ToastManager } from '@/types/extensionTypes'

import { useCommandStore } from './commandStore'
import { useQueueSettingsStore } from './queueStore'
import { useSettingStore } from './settingStore'
import { useToastStore } from './toastStore'
import { useWorkflowStore } from './workflowStore'
import { useSidebarTabStore } from './workspace/sidebarTabStore'

export const useWorkspaceStore = defineStore('workspace', () => {
  const spinner = ref(false)
  const shiftDown = ref(false)
  /**
   * Whether the workspace is in focus mode.
   * When in focus mode, only the graph editor is visible.
   */
  const focusMode = ref(false)

  const toast = computed<ToastManager>(() => useToastStore())
  const queueSettings = computed(() => useQueueSettingsStore())
  const command = computed(() => ({
    commands: useCommandStore().commands,
    execute: useCommandStore().execute
  }))
  const sidebarTab = computed(() => useSidebarTabStore())
  const setting = computed(() => ({
    settings: useSettingStore().settingsById,
    get: useSettingStore().get,
    set: useSettingStore().set
  }))
  const workflow = computed(() => useWorkflowStore())
  const colorPalette = useColorPaletteService()
  const dialog = useDialogService()

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
    focusMode,
    toggleFocusMode: () => {
      focusMode.value = !focusMode.value
    },
    toast,
    queueSettings,
    command,
    sidebarTab,
    setting,
    workflow,
    colorPalette,
    dialog,

    registerSidebarTab,
    unregisterSidebarTab,
    getSidebarTabs
  }
})
