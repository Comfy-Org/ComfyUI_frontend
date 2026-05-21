import type { Component } from 'vue'

import type { SettingParams } from '@/platform/settings/types'
import type { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
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

/**
 * Defines message options in Toast component. Passed to {@link toast.show} /
 * {@link toast.remove} to surface a transient message to the user.
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { toast } from '@comfyorg/extension-api'
 *
 * toast.show({ severity: 'info', summary: 'Saved', life: 2000 })
 * ```
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
  detail?: string
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
  styleClass?: string | string[] | Record<string, boolean>
  /**
   * Style class of the content.
   * Matches PrimeVue Toast API which accepts Vue class bindings.
   */
  contentStyleClass?: string | string[] | Record<string, boolean>
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
    get: <T = unknown>(id: string) => T | undefined
    set: <T = unknown>(id: string, value: T) => void
  }
  workflow: ReturnType<typeof useWorkflowStore>

  // Execution error state (read-only)
  lastNodeErrors: Record<NodeId, NodeError> | null
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

// ─────────────────────────────────────────────────────────────────────────────
// D-shell-ui-entrypoints (W6.P5.C) — per-surface registration arg types
// ─────────────────────────────────────────────────────────────────────────────
//
// Each `defineX` entry point in `@comfyorg/extension-api` accepts one of the
// types below. The shapes are deliberately thin POJOs (not class instances) so
// they are JSON-friendly, tree-shake-friendly, and easy to author/test in
// isolation. The runtime wraps each one into the appropriate store registration
// at mount time (see `src/extension-api/registrations.ts`).
//
// New types added under (ii) "separate entries" per W6.P5.B reconciliation:
//   - HotkeyExtension
//   - AboutBadgeExtension
//   - SettingDefinition
//   - ToolbarButtonExtension
//   - CommandDefinition (alias of v1 ComfyCommand for the public surface)

/**
 * Public arg type for {@link defineCommand}. Alias of the v1 `ComfyCommand`
 * shape exported from `@/stores/commandStore`, re-surfaced under a public name
 * so authors do not import from the internal `stores/` path.
 *
 * @publicAPI
 * @stability experimental
 */
export type CommandDefinition = ComfyCommand

/**
 * Public arg type for {@link defineHotkey}. A hotkey binds a key combination
 * (already-registered command) to fire on press. Mirrors v1
 * `extension.keybindings[]` which used the internal `Keybinding` shape.
 *
 * `keys` accepts a human-readable combo string (e.g. `'mod+k'`, `'ctrl+shift+f'`)
 * matching the Vue/PrimeVue keybinding convention. `mod` resolves to `cmd` on
 * macOS and `ctrl` elsewhere. The runtime parses this into the underlying
 * `KeyCombo` shape used by the keybinding store.
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { defineCommand, defineHotkey } from '@comfyorg/extension-api'
 *
 * defineCommand({ id: 'my.cmd', function: () => {} })
 * defineHotkey({ keys: 'mod+k', commandId: 'my.cmd' })
 * ```
 */
export interface HotkeyExtension {
  /**
   * Key combination to listen for. Examples: `'mod+k'`, `'ctrl+shift+f'`,
   * `'alt+enter'`. `mod` resolves to `cmd` on macOS and `ctrl` elsewhere.
   */
  keys: string
  /**
   * The id of an already-registered command. Use {@link defineCommand} to
   * register the command before (or alongside) the hotkey.
   */
  commandId: string
  /**
   * Optional id of the DOM element that must be focused for the hotkey to
   * fire. When omitted, the hotkey is global.
   */
  targetElementId?: string
}

/**
 * Public arg type for {@link defineAboutBadge}. A badge that appears on the
 * About page (linked label + icon + optional severity). Mirrors v1
 * `extension.aboutPageBadges[]`.
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { defineAboutBadge } from '@comfyorg/extension-api'
 *
 * defineAboutBadge({
 *   label: 'GitHub',
 *   url: 'https://github.com/me/my-ext',
 *   icon: 'pi-github'
 * })
 * ```
 */
export interface AboutBadgeExtension {
  /** Display label for the badge. */
  label: string
  /** URL the badge links to on click. */
  url: string
  /** Icon class (e.g. `'pi-github'`) shown next to the label. */
  icon: string
  /** Optional severity tint; defaults to neutral. */
  severity?: 'danger' | 'warn'
}

/**
 * Public arg type for {@link defineSetting}. Re-surfaces the existing
 * `SettingParams` shape (from `@/platform/settings/types`) under a public name
 * so authors do not import from the internal `platform/` path.
 *
 * Note: the underlying `SettingParams.id` is typed against the `Settings`
 * keymap; for ecosystem extension settings, authors widen the id type via
 * `as keyof Settings` or rely on TS module augmentation of `Settings` (a
 * follow-on RFC will formalize the augmentation path).
 *
 * @publicAPI
 * @stability experimental
 */
export type SettingDefinition<TValue = unknown> = SettingParams<TValue>

/**
 * Public arg type for {@link defineToolbarButton}. A button that appears in
 * the action bar (top of the canvas area). Wraps the v1
 * `extension.actionBarButtons[]` shape with an `id` so each registration is
 * independently disposable.
 *
 * **Net-new surface**: no v1 registration path existed for toolbar buttons
 * (action-bar buttons were possible but undocumented and never had a
 * `defineToolbarButton` equivalent). Per W6.P5 evidence sweep this surface
 * had 0 hits across the 138-repo corpus — any first-mover use is greenfield.
 *
 * @publicAPI
 * @stability experimental
 * @example
 * ```ts
 * import { defineToolbarButton } from '@comfyorg/extension-api'
 *
 * defineToolbarButton({
 *   id: 'my.help',
 *   icon: 'pi-question-circle',
 *   tooltip: 'Get help',
 *   onClick: () => openHelp()
 * })
 * ```
 */
export interface ToolbarButtonExtension {
  /** Stable id for the button — used by `dispose()` to unregister. */
  id: string
  /**
   * Icon class to display (e.g. `'icon-[lucide--message-circle-question-mark]'`).
   */
  icon: string
  /** Optional label text shown next to the icon. */
  label?: string
  /** Optional tooltip shown on hover. */
  tooltip?: string
  /** Optional CSS class string applied to the button element. */
  class?: string
  /** Click handler invoked when the button is pressed. */
  onClick: () => void
}
