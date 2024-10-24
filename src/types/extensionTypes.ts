import type { ToastMessageOptions } from 'primevue/toast'
import { Component } from 'vue'

export interface BaseSidebarTabExtension {
  id: string
  title: string
  icon?: string
  iconBadge?: string | (() => string | null)
  tooltip?: string
}

export interface BaseBottomPanelExtension {
  id: string
  title: string
}

export interface VueExtension {
  id: string
  type: 'vue'
  component: Component
}

export interface CustomExtension {
  id: string
  type: 'custom'
  render: (container: HTMLElement) => void
  destroy?: () => void
}

export type VueSidebarTabExtension = BaseSidebarTabExtension & VueExtension
export type CustomSidebarTabExtension = BaseSidebarTabExtension &
  CustomExtension
export type SidebarTabExtension =
  | VueSidebarTabExtension
  | CustomSidebarTabExtension

export type VueBottomPanelExtension = BaseBottomPanelExtension & VueExtension
export type CustomBottomPanelExtension = BaseBottomPanelExtension &
  CustomExtension
export type BottomPanelExtension =
  | VueBottomPanelExtension
  | CustomBottomPanelExtension

export type ToastManager = {
  add(message: ToastMessageOptions): void
  remove(message: ToastMessageOptions): void
  removeAll(): void
}

export interface ExtensionManager {
  // Sidebar tabs
  registerSidebarTab(tab: SidebarTabExtension): void
  unregisterSidebarTab(id: string): void
  getSidebarTabs(): SidebarTabExtension[]

  toast: ToastManager
  command: CommandManager
  setting: {
    get: (id: string) => any
    set: (id: string, value: any) => void
  }
}

export interface CommandManager {
  execute(command: string, errorHandler?: (error: any) => void): void
}
