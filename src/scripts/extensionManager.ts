import { useWorkspaceStore } from '@/stores/workspaceStateStore'
import { ExtensionManager, SidebarTabExtension } from '@/types/extensionTypes'

export class ExtensionManagerImpl implements ExtensionManager {
  private sidebarTabs: SidebarTabExtension[] = []
  private workspaceStore = useWorkspaceStore()

  registerSidebarTab(tab: SidebarTabExtension) {
    this.sidebarTabs.push(tab)
    this.updateSidebarOrder()
  }

  unregisterSidebarTab(id: string) {
    const index = this.sidebarTabs.findIndex((tab) => tab.id === id)
    if (index !== -1) {
      const tab = this.sidebarTabs[index]
      if (tab.type === 'custom' && tab.destroy) {
        tab.destroy()
      }
      this.sidebarTabs.splice(index, 1)
      this.updateSidebarOrder()
    }
  }

  getSidebarTabs() {
    return this.sidebarTabs.sort((a, b) => {
      const orderA = this.workspaceStore.sidebarTabsOrder.indexOf(a.id)
      const orderB = this.workspaceStore.sidebarTabsOrder.indexOf(b.id)
      return orderA - orderB
    })
  }

  private updateSidebarOrder() {
    const currentOrder = this.workspaceStore.sidebarTabsOrder
    const newTabs = this.sidebarTabs.filter(
      (tab) => !currentOrder.includes(tab.id)
    )
    this.workspaceStore.updateSidebarOrder([
      ...currentOrder,
      ...newTabs.map((tab) => tab.id)
    ])
  }
}
