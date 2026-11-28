import { clamp } from 'es-toolkit'

import { resizeAxes } from '@/renderer/extensions/vueNodes/interactions/resize/resizeDirection'
import type { ResizeDirection } from '@/renderer/extensions/vueNodes/interactions/resize/resizeDirection'

export type PanelSize = { width: number; height: number }

/** The side of its trigger a resized panel stays on. */
export type PanelSide = 'top' | 'bottom'

const MIN_PANEL_SIZE: PanelSize = { width: 320, height: 320 }
const VIEWPORT_PADDING = 8

/** Size of a popover panel after its `direction` handle moves by `pointer`. */
export function resizePanel(
  start: PanelSize,
  pointer: { x: number; y: number },
  { direction, max }: { direction: ResizeDirection; max: PanelSize }
): PanelSize {
  const axes = resizeAxes(direction)
  return {
    width: clamp(
      start.width + axes.x * pointer.x,
      MIN_PANEL_SIZE.width,
      max.width
    ),
    height: clamp(
      start.height + axes.y * pointer.y,
      MIN_PANEL_SIZE.height,
      max.height
    )
  }
}

/** Largest size the `direction` handle can drag the panel at `rect` to while its moving edges stay inside the viewport. */
export function roomInViewport(
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  viewport: PanelSize,
  direction: ResizeDirection
): PanelSize {
  const axes = resizeAxes(direction)
  const room = (sign: number, before: number, after: number) =>
    sign < 0
      ? before - VIEWPORT_PADDING
      : sign > 0
        ? after - VIEWPORT_PADDING
        : Infinity
  return {
    width: room(axes.x, rect.right, viewport.width - rect.left),
    height: room(axes.y, rect.bottom, viewport.height - rect.top)
  }
}

/** `size` raised to the minimum panel size, for sizes saved under an older minimum. */
export function atLeastMinimumSize(size: PanelSize): PanelSize {
  return {
    width: Math.max(size.width, MIN_PANEL_SIZE.width),
    height: Math.max(size.height, MIN_PANEL_SIZE.height)
  }
}
