import type { SidebarTabExtension, ToastManager } from '@/types/extensionTypes'
import { defineStore } from 'pinia'
import { useToastStore } from './toastStore'
import { useQueueSettingsStore } from './queueStore'
import { useCommandStore } from './commandStore'
import { useSidebarTabStore } from './workspace/sidebarTabStore'

interface WorkspaceState {
  spinner: boolean
  // Whether the shift key is down globally
  shiftDown: boolean
}

export const useWorkspaceStore = defineStore('workspace', {
  state: (): WorkspaceState => ({
    spinner: false,
    shiftDown: false
  }),
  getters: {
    toast(): ToastManager {
      return useToastStore()
    },
    queueSettings() {
      return useQueueSettingsStore()
    },
    command() {
      return {
        execute: useCommandStore().execute
      }
    },
    sidebarTab() {
      return useSidebarTabStore()
    }
  },
  actions: {
    registerSidebarTab(tab: SidebarTabExtension) {
      this.sidebarTab.registerSidebarTab(tab)
      useCommandStore().registerCommand({
        id: `Workspace.ToggleSidebarTab.${tab.id}`,
        icon: tab.icon,
        label: tab.tooltip,
        tooltip: tab.tooltip,
        versionAdded: '1.3.9',
        function: () => {
          this.sidebarTab.toggleSidebarTab(tab.id)
        }
      })
    },
    unregisterSidebarTab(id: string) {
      this.sidebarTab.unregisterSidebarTab(id)
    },
    getSidebarTabs(): SidebarTabExtension[] {
      return this.sidebarTab.sidebarTabs
    }
  }
})
