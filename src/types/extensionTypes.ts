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

export interface ExtensionManager {
  registerSidebarTab(tab: SidebarTabExtension): void
  unregisterSidebarTab(id: string): void
  getSidebarTabs(): SidebarTabExtension[]
}
