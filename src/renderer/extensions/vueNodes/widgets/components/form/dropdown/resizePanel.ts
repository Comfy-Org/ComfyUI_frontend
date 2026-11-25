import { clamp } from 'es-toolkit'

export type PanelSize = { width: number; height: number }

const MIN_PANEL_SIZE: PanelSize = { width: 288, height: 320 }

/**
 * Size of a popover panel anchored at its right edge after its free corner
 * moves by `pointer`; the free corner is bottom-left, or top-left when `growsUp`.
 */
export function resizePanel(
  start: PanelSize,
  pointer: { x: number; y: number },
  { growsUp, max }: { growsUp: boolean; max: PanelSize }
): PanelSize {
  return {
    width: clamp(start.width - pointer.x, MIN_PANEL_SIZE.width, max.width),
    height: clamp(
      growsUp ? start.height - pointer.y : start.height + pointer.y,
      MIN_PANEL_SIZE.height,
      max.height
    )
  }
}
