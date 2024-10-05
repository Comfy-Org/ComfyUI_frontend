import type { SidebarTabExtension, ToastManager } from '@/types/extensionTypes'
import { defineStore } from 'pinia'
import { useToastStore } from './toastStore'
import { useQueueSettingsStore } from './queueStore'
import { useMenuItemStore } from './menuItemStore'
import { useCommandStore } from './commandStore'

interface WorkspaceState {
  spinner: boolean
  activeSidebarTab: string | null
  sidebarTabs: SidebarTabExtension[]
}

export const useWorkspaceStore = defineStore('workspace', {
  state: (): WorkspaceState => ({
    spinner: false,
    activeSidebarTab: null,
    sidebarTabs: []
  }),
  getters: {
    toast(): ToastManager {
      return useToastStore()
    },
    queueSettings() {
      return useQueueSettingsStore()
    },
    menu() {
      return {
        registerTopbarCommands: useMenuItemStore().registerCommands
      }
    },
    command() {
      return {
        execute: useCommandStore().execute
      }
    }
  },
  actions: {
    updateActiveSidebarTab(tabId: string) {
      this.activeSidebarTab = tabId
    },
    toggleSidebarTab(tabId: string) {
      this.activeSidebarTab = this.activeSidebarTab === tabId ? null : tabId
    },
    registerSidebarTab(tab: SidebarTabExtension) {
      this.sidebarTabs = [...this.sidebarTabs, tab]
      useCommandStore().registerCommand({
        id: `Workspace.ToggleSidebarTab.${tab.id}`,
        icon: tab.icon,
        label: tab.tooltip,
        tooltip: tab.tooltip,
        versionAdded: '1.3.9',
        function: () => {
          this.toggleSidebarTab(tab.id)
        }
      })
    },
    unregisterSidebarTab(id: string) {
      const index = this.sidebarTabs.findIndex((tab) => tab.id === id)
      if (index !== -1) {
        const tab = this.sidebarTabs[index]
        if (tab.type === 'custom' && tab.destroy) {
          tab.destroy()
        }
        const newSidebarTabs = [...this.sidebarTabs]
        newSidebarTabs.splice(index, 1)
        this.sidebarTabs = newSidebarTabs
      }
    },
    getSidebarTabs() {
      return [...this.sidebarTabs]
    }
  }
})
