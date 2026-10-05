import type { Component } from 'vue'

import type { ToastId, ToastOptions } from '@/components/ui/toast/toastStore'

import type { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ExecutionErrorWsMessage } from '@/platform/remote/comfyui/execution/types'
import type { NodeError } from '@/platform/remote/comfyui/types'
import type { useDialogService } from '@/services/dialogService'
import type { ComfyCommand } from '@/stores/commandStore'

interface BaseSidebarTabExtension {
  id: string
  title: string
  icon?: string | Component
  iconBadge?: string | (() => string | null)
  tooltip?: string
  label?: string
  onToggle?: () => boolean | Promise<boolean>
}

interface BaseBottomPanelExtension {
  id: string
  title?: string // For extensions that provide static titles
  titleKey?: string // For core tabs with i18n keys
  targetPanel?: 'terminal' | 'shortcuts'
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

type VueSidebarTabExtension = BaseSidebarTabExtension & VueExtension
type CustomSidebarTabExtension = BaseSidebarTabExtension & CustomExtension
export type SidebarTabExtension =
  | VueSidebarTabExtension
  | CustomSidebarTabExtension

type VueBottomPanelExtension = BaseBottomPanelExtension & VueExtension
type CustomBottomPanelExtension = BaseBottomPanelExtension & CustomExtension
export type BottomPanelExtension =
  | VueBottomPanelExtension
  | CustomBottomPanelExtension

/**
 * @deprecated Use `toast.success/error/info/warning(title, options)`.
 */
export interface ToastMessageOptions {
  severity?: 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast'
  summary?: string
  detail?: string
  closable?: boolean
  life?: number
}

export type ToastManager = {
  success(title: string, options?: ToastOptions): ToastId
  error(title: string, options?: ToastOptions): ToastId
  info(title: string, options?: ToastOptions): ToastId
  warning(title: string, options?: ToastOptions): ToastId
  loading(title: string, options?: ToastOptions): ToastId
  dismiss(id: ToastId): void
  dismissAll(): void
  /** @deprecated Use `success/error/info/warning`. */
  add(message: ToastMessageOptions): void
  /** @deprecated Use `dismiss(id)`. */
  remove(message: ToastMessageOptions): void
  /** @deprecated Use `dismissAll()`. */
  removeAll(): void
  /** @deprecated Use `warning(title, { description })`. */
  addAlert(message: string): void
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
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- Custom extensions declare settings outside the generated schema.
    get: <T = unknown>(id: string) => T | undefined
    set: (id: string, value: unknown) => void
  }
  workflow: ReturnType<typeof useWorkflowStore>

  // Execution error state (read-only)
  lastNodeErrors: Record<string, NodeError> | null
  lastExecutionError: ExecutionErrorWsMessage | null

  /**
   * Renders a markdown string to sanitized HTML.
   * Uses marked (GFM) + DOMPurify. Safe for direct use with innerHTML.
   * @param markdown - The markdown string to render.
   * @param baseUrl - Optional base URL for resolving relative image/media paths.
   */
  renderMarkdownToHtml(markdown: string, baseUrl?: string): string
}

export interface CommandManager {
  commands: ComfyCommand[]
  execute(
    command: string,
    options?: {
      errorHandler?: (error: unknown) => void
      metadata?: Record<string, unknown>
    }
  ): void
}
