import type { ToastMessageOptions } from 'primevue/toast'
import { Component } from 'vue'

export interface BaseSidebarTabExtension {
  id: string
  title: string
  icon?: string
  iconBadge?: string | (() => string | null)
  order?: number
  tooltip?: string
}

export interface VueSidebarTabExtension extends BaseSidebarTabExtension {
  type: 'vue'
  component: Component
}

export interface CustomSidebarTabExtension extends BaseSidebarTabExtension {
  type: 'custom'
  render: (container: HTMLElement) => void
  destroy?: () => void
}

export type SidebarTabExtension =
  | VueSidebarTabExtension
  | CustomSidebarTabExtension

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

  // Toast
  toast: ToastManager
}
