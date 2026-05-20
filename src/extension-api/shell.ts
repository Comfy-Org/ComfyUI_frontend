/**
 * Shell UI extension types — sidebar tabs, bottom panels, commands, hotkeys,
 * settings, about badges, toolbar buttons, toasts.
 *
 * Re-exported from `src/types/extensionTypes.ts` with no shape changes. Each
 * registerable shell UI surface has its own `defineX` entry point in
 * `@/extension-api/registrations`; the arg types for those entries are
 * re-exported here. Toast + notification surfaces remain inline-imperative
 * (see `@/extension-api/imperatives`).
 *
 * @packageDocumentation
 */

// VueExtension and CustomExtension are intentionally NOT re-exported — they
// are discriminated-union ingredients of SidebarTabExtension /
// BottomPanelExtension, not author-facing entry points. Internal callers
// (ExtensionSlot.vue) import them directly from '@/types/extensionTypes'.
export type {
  // Pre-existing types (unchanged shape)
  SidebarTabExtension,
  BottomPanelExtension,
  ToastMessageOptions,
  ToastManager,
  // Net-new shell-UI arg types
  CommandDefinition,
  HotkeyExtension,
  AboutBadgeExtension,
  SettingDefinition,
  ToolbarButtonExtension
} from '@/types/extensionTypes'
