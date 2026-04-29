/**
 * Positioning classes per FloatingPanel preset. Consumed by
 * FloatingPanel and PanelDragPreview so the live panel and drop-
 * target outline land at identical coordinates.
 *
 * Left/right offsets assume the parent container already excludes
 * the Comfy sidebar — don't add a sidebar width here.
 */
import type { PanelPreset } from './panelTypes'

const TOP_BELOW_CHROME =
  'top-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))]'
const BOTTOM_ABOVE_CHROME =
  'bottom-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))]'
const RIGHT_EDGE = 'right-(--spacing-layout-outer)'
const LEFT_EDGE = 'left-(--spacing-layout-outer)'
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
