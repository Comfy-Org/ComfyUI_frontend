/**
 * Shell UI extension types — sidebar tabs, bottom panels, commands, toasts.
 *
 * Moved from `src/types/extensionTypes.ts` with no shape changes. This
 * re-export makes all shell types available from the single
 * `@comfyorg/extension-api` package entry point.
 *
 * @packageDocumentation
 */

// VueExtension and CustomExtension are deliberately NOT re-exported per D19 —
// they are discriminated-union ingredients of SidebarTabExtension /
// BottomPanelExtension, not author-facing entry points. Internal callers
// (ExtensionSlot.vue) import them directly from '@/types/extensionTypes'.
export type {
  SidebarTabExtension,
  BottomPanelExtension,
  ToastMessageOptions,
  ToastManager,
  ExtensionManager,
  CommandManager
} from '@/types/extensionTypes'
