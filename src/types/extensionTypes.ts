import { Component } from 'vue'

import type { useDialogService } from '@/services/dialogService'
import type { ComfyCommand } from '@/stores/commandStore'

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

/**
 * Defines message options in Toast component.
 */
export interface ToastMessageOptions {
  /**
   * Severity level of the message.
   * @defaultValue info
   */
  severity?:
    | 'success'
    | 'info'
    | 'warn'
    | 'error'
    | 'secondary'
    | 'contrast'
    | undefined
  /**
   * Summary content of the message.
   */
  summary?: string | undefined
  /**
   * Detail content of the message.
   */
  detail?: any | undefined
  /**
   * Whether the message can be closed manually using the close icon.
   * @defaultValue true
   */
  closable?: boolean | undefined
  /**
   * Delay in milliseconds to close the message automatically.
   */
  life?: number | undefined
  /**
   * Key of the Toast to display the message.
   */
  group?: string | undefined
  /**
   * Style class of the message.
   */
  styleClass?: any
  /**
   * Style class of the content.
   */
  contentStyleClass?: any
}

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
  dialog: ReturnType<typeof useDialogService>
  command: CommandManager
  setting: {
    get: (id: string) => any
    set: (id: string, value: any) => void
  }
}

export interface CommandManager {
  commands: ComfyCommand[]
  execute(command: string, errorHandler?: (error: any) => void): void
}
