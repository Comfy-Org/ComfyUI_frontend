import { clamp } from 'es-toolkit'

export type PanelSize = { width: number; height: number }

/** A grip on the popover: the two free corners, the left edge, or the free horizontal edge. */
export type ResizeHandle =
  | 'left-corner'
  | 'right-corner'
  | 'left-edge'
  | 'free-edge'

const MIN_PANEL_SIZE: PanelSize = { width: 320, height: 320 }

const HANDLE_AXES: Record<ResizeHandle, { x: -1 | 0 | 1; y: boolean }> = {
  'left-corner': { x: -1, y: true },
  'right-corner': { x: 1, y: true },
  'left-edge': { x: -1, y: false },
  'free-edge': { x: 0, y: true }
}

/**
 * Size of a popover panel after `handle` moves by `pointer`. The free
 * horizontal edge is the bottom one, or the top one when `growsUp`.
 */
export function resizePanel(
  start: PanelSize,
  pointer: { x: number; y: number },
  {
    handle,
    growsUp,
    max
  }: { handle: ResizeHandle; growsUp: boolean; max: PanelSize }
): PanelSize {
  const axes = HANDLE_AXES[handle]
  const dy = axes.y ? (growsUp ? -pointer.y : pointer.y) : 0
  return {
    width: clamp(
      start.width + axes.x * pointer.x,
      MIN_PANEL_SIZE.width,
      max.width
    ),
    height: clamp(start.height + dy, MIN_PANEL_SIZE.height, max.height)
  }
}

/** Whether `handle` grows the panel's right side, which the trigger-aligned popover must shift to keep its left edge in place. */
export function growsRight(handle: ResizeHandle): boolean {
  return HANDLE_AXES[handle].x === 1
}
