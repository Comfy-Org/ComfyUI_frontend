/**
 * Shared Tailwind class strings for each FloatingPanel preset
 * position. Consumed by FloatingPanel (the live panel) and
 * PanelDragPreview (the blue drop-target outline) so the two always
 * land at the same coordinates.
 *
 * The anchor + height chunks are named constants so each preset's
 * geometry reads as a short combination instead of a wall of
 * repeated `calc(...)` expressions. Keep the Tailwind arbitrary-
 * value strings on a single line — the JIT scanner needs to see
 * the full `h-[calc(...)]` / `top-[calc(...)]` token unbroken.
 *
 * Left-anchored presets offset by `--sidebar-width` so the panel
 * clears the Comfy sidebar icon strip when the sidebar is on the
 * left; the fallback to 0px keeps right-sidebar / hidden-sidebar
 * layouts correct.
 */
import type { PanelPreset } from './panelTypes'

// Top / bottom anchors (outer padding + 1 cell row + gutter below
// the chrome rail). Named for readability in the preset map.
const TOP_BELOW_CHROME =
  'top-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))]'
const BOTTOM_ABOVE_CHROME =
  'bottom-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))]'

// Side anchors.
const RIGHT_EDGE = 'right-(--spacing-layout-outer)'
const LEFT_WITH_SIDEBAR =
  'left-[calc(var(--sidebar-width,0px)+var(--spacing-layout-outer))]'

// Vertical size. Dock presets stretch to fill the slot between the
// top and bottom chrome rails; float presets stay content-driven
// under a half-viewport cap. Both docks use the same height now that
// the bottom chrome has cells on both sides (feedback on the left,
// zoom cluster on the right) — the panel has to clear either one
// regardless of which side it's docked against.
const DOCK_H =
  'h-[calc(100%-var(--spacing-layout-outer)*2-var(--spacing-layout-cell)*2-var(--spacing-layout-gutter)*2)]'
const FLOAT_MAX_H = 'max-h-[calc(50%-var(--spacing-layout-outer)-4px)]'

export const PANEL_PRESET_CLASSES: Record<PanelPreset, string> = {
  'right-dock': `${TOP_BELOW_CHROME} ${RIGHT_EDGE} ${DOCK_H}`,
  'left-dock': `${TOP_BELOW_CHROME} ${LEFT_WITH_SIDEBAR} ${DOCK_H}`,
  'float-tr': `${TOP_BELOW_CHROME} ${RIGHT_EDGE} ${FLOAT_MAX_H}`,
  'float-br': `${BOTTOM_ABOVE_CHROME} ${RIGHT_EDGE} ${FLOAT_MAX_H}`,
  'float-tl': `${TOP_BELOW_CHROME} ${LEFT_WITH_SIDEBAR} ${FLOAT_MAX_H}`,
  'float-bl': `${BOTTOM_ABOVE_CHROME} ${LEFT_WITH_SIDEBAR} ${FLOAT_MAX_H}`
}
