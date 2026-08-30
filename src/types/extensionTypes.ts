import type { Component } from 'vue'

import type { ToastId, ToastOptions } from '@/components/ui/toast'

import type { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ExecutionErrorWsMessage, NodeError } from '@/schemas/apiSchema'
import type { useDialogService } from '@/services/dialogService'
import type { ComfyCommand } from '@/stores/commandStore'

interface BaseSidebarTabExtension {
  id: string
  title: string
  icon?: string | Component
  iconBadge?: string | (() => string | null)
  tooltip?: string
  label?: string
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

export type ToastManager = {
  success(title: string, options?: ToastOptions): ToastId
  error(title: string, options?: ToastOptions): ToastId
  info(title: string, options?: ToastOptions): ToastId
  warning(title: string, options?: ToastOptions): ToastId
  loading(title: string, options?: ToastOptions): ToastId
  dismiss(id: ToastId): void
  dismissAll(): void
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
    get: <T = unknown>(id: string) => T | undefined
    set: <T = unknown>(id: string, value: T) => void
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
