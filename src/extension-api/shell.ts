/**
 * Shell UI extension types — sidebar tabs, bottom panels, commands, toasts.
 *
 * Moved from `src/types/extensionTypes.ts` with no shape changes. This
 * re-export makes all shell types available from the single
 * `@comfyorg/extension-api` package entry point.
 *
 * @packageDocumentation
 */

export type {
  SidebarTabExtension,
  BottomPanelExtension,
  VueExtension,
  CustomExtension,
  ToastMessageOptions,
  ToastManager,
  ExtensionManager,
  CommandManager
} from '@/types/extensionTypes'
