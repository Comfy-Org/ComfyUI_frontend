import { SidebarTabExtension, ToastManager } from '@/types/extensionTypes'
import { defineStore } from 'pinia'
import { useToastStore } from './toastStore'

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
    }
  },
  actions: {
    updateActiveSidebarTab(tabId: string) {
      this.activeSidebarTab = tabId
    },
    registerSidebarTab(tab: SidebarTabExtension) {
      this.sidebarTabs = [...this.sidebarTabs, tab]
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
