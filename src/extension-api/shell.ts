/**
 * Shell UI extension types — sidebar tabs, bottom panels, commands, hotkeys,
 * settings, about badges, toolbar buttons, toasts.
 *
 * Re-exported from `src/types/extensionTypes.ts` with no shape changes. The
 * original module remains the source of truth; this barrel makes the shell
 * types available from the single `@comfyorg/extension-api` package entry
 * point.
 *
 * ## What changed in W6.P5 (D-shell-ui-entrypoints)
 *
 * The v2 public surface follows option (ii) "separate entries" — every
 * registerable shell UI surface gets its own `defineX` entry point in
 * `@/extension-api/registrations`, and the **arg types** for those entries
 * are re-exported here. `ExtensionManager` and `CommandManager` are no
 * longer part of the public API (they were v1 umbrella handles); per-surface
 * disposable handles returned by each `defineX` replace them.
 *
 * Toast + notification surfaces remain inline-imperative (see
 * `@/extension-api/imperatives`) — the carve-out per the ACCEPTED ADR.
 *
 * @packageDocumentation
 */

// VueExtension and CustomExtension are deliberately NOT re-exported per D19 —
// they are discriminated-union ingredients of SidebarTabExtension /
// BottomPanelExtension, not author-facing entry points. Internal callers
// (ExtensionSlot.vue) import them directly from '@/types/extensionTypes'.
//
// Per W6.P5.B (D-shell-ui-entrypoints) the public surface adds 5 net-new
// argument types (HotkeyExtension, AboutBadgeExtension, SettingDefinition,
// ToolbarButtonExtension, CommandDefinition) and DROPS ExtensionManager +
// CommandManager from the v2 public re-export — the legacy umbrella handles
// have no role under option (ii) since each defineX returns its own
// per-surface disposable.
export type {
  // Pre-existing types (unchanged shape)
  SidebarTabExtension,
  BottomPanelExtension,
  ToastMessageOptions,
  ToastManager,
  // Net-new W6.P5 arg types
  CommandDefinition,
  HotkeyExtension,
  AboutBadgeExtension,
  SettingDefinition,
  ToolbarButtonExtension
} from '@/types/extensionTypes'
