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
 * Left anchors use `--spacing-layout-outer` only — no sidebar offset.
 * Both consumers position FloatingPanel inside a container whose
 * origin already starts after the Comfy sidebar (LayoutView is a
 * flex sibling of the sidebar; BuilderPanel's wrapper applies its
 * own `left-(--sidebar-width,0px)`), so adding the sidebar width
 * here would double-count and leave a visible gap. The outer
 * padding matches the chrome-cell column on the same side so the
 * panel reads as part of the same vertical rail.
 */
import type { PanelPreset } from './panelTypes'

// Top / bottom anchors (outer padding + 1 cell row + gutter below
// the chrome rail). Named for readability in the preset map.
const TOP_BELOW_CHROME =
  'top-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))]'
const BOTTOM_ABOVE_CHROME =
  'bottom-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))]'

// Side anchors. Both edges use `--spacing-layout-outer` so the panel
// aligns with the chrome-cell column on its side (top-left chrome
// zone is at `left-(--spacing-layout-outer)`, top-right at
// `right-(--spacing-layout-outer)` — the panel should hug the same
// rail). The panel's ancestor already excludes the Comfy sidebar
// (LayoutView via flex sibling, BuilderPanel via its wrapper's
// `left-(--sidebar-width,0px)`), so no extra sidebar offset here.
const RIGHT_EDGE = 'right-(--spacing-layout-outer)'
const LEFT_EDGE = 'left-(--spacing-layout-outer)'

// Vertical size. Dock presets pin BOTH top and bottom anchors so the
// panel always spans the full slot between the chrome rails — the
// body's `overflow-y-auto` handles overflow when the widget list is
// taller than the slot, and short widget lists get the breathing
// room of the available empty space rather than leaving it unused.
// Float presets are content-driven from their anchored corner
// outward, capped at the same full-slot height so the inner edge
// expands to show every widget that fits and only scrolls once the
// panel actually reaches the opposite chrome rail.
const SLOT_MAX_H =
  'max-h-[calc(100%-var(--spacing-layout-outer)*2-var(--spacing-layout-cell)*2-var(--spacing-layout-gutter)*2)]'

export const PANEL_PRESET_CLASSES: Record<PanelPreset, string> = {
  'right-dock': `${TOP_BELOW_CHROME} ${BOTTOM_ABOVE_CHROME} ${RIGHT_EDGE}`,
  'left-dock': `${TOP_BELOW_CHROME} ${BOTTOM_ABOVE_CHROME} ${LEFT_EDGE}`,
  'float-tr': `${TOP_BELOW_CHROME} ${RIGHT_EDGE} ${SLOT_MAX_H}`,
  'float-br': `${BOTTOM_ABOVE_CHROME} ${RIGHT_EDGE} ${SLOT_MAX_H}`,
  'float-tl': `${TOP_BELOW_CHROME} ${LEFT_EDGE} ${SLOT_MAX_H}`,
  'float-bl': `${BOTTOM_ABOVE_CHROME} ${LEFT_EDGE} ${SLOT_MAX_H}`
}
