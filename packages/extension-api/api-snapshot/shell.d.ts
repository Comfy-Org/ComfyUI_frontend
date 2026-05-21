/**
 * Shell UI extension types — sidebar tabs, bottom panels, commands, toasts.
 *
 * Re-exported from `src/types/extensionTypes.ts` with no shape changes.
 * The original module remains the source of truth; this barrel makes the
 * shell types available from the single `@comfyorg/extension-api` package
 * entry point.
 *
 * @stability stable
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
} from '../types/extensionTypes'
