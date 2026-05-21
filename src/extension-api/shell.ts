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
  /**
   * Options bag for {@link defineSidebarTab}.
   * @see {@link defineSidebarTab} for a usage example.
   */
  SidebarTabExtension,
  /**
   * Options bag for {@link defineBottomPanelTab}.
   * @see {@link defineBottomPanelTab} for a usage example.
   */
  BottomPanelExtension,
  /**
   * Options bag for {@link toast.show} / {@link toast.remove}.
   * @see {@link toast} for a usage example.
   */
  ToastMessageOptions,
  /**
   * Manager interface backing the {@link toast} surface.
   * @see {@link toast} for a usage example.
   */
  ToastManager,
  // Net-new shell-UI arg types
  /**
   * Options bag for {@link defineCommand}.
   * @see {@link defineCommand} for a usage example.
   */
  CommandDefinition,
  /**
   * Options bag for {@link defineHotkey}.
   * @see {@link defineHotkey} for a usage example.
   */
  HotkeyExtension,
  /**
   * Options bag for {@link defineAboutBadge}.
   * @see {@link defineAboutBadge} for a usage example.
   */
  AboutBadgeExtension,
  /**
   * Options bag for {@link defineSetting}.
   * @see {@link defineSetting} for a usage example.
   */
  SettingDefinition,
  /**
   * Options bag for {@link defineToolbarButton}.
   * @see {@link defineToolbarButton} for a usage example.
   */
  ToolbarButtonExtension
} from '@/types/extensionTypes'
