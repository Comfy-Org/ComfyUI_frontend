import { tryOnScopeDispose, useEventListener } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import type { MaybeRefOrGetter, Ref } from 'vue'

/** Thumbnail tile width range in CSS pixels. */
export const THUMBNAIL_SIZE = { min: 64, default: 96, max: 400 } as const

const LINE_DELTA_MODE = 1
const LINE_HEIGHT_PX = 16
const MAX_WHEEL_STEP_PX = 50
const WHEEL_PX_PER_E_FOLD = 200

/** `size` scaled by `factor`, kept within {@link THUMBNAIL_SIZE}. */
export function zoomThumbnail(size: number, factor: number): number {
  return clamp(size * factor, THUMBNAIL_SIZE.min, THUMBNAIL_SIZE.max)
}

/** Scale factor for one Ctrl/Cmd + wheel event: trackpad pinches zoom smoothly, mouse notches by about a fifth. */
export function wheelZoomFactor({
  deltaY,
  deltaMode
}: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  const pixels =
    deltaMode === LINE_DELTA_MODE ? deltaY * LINE_HEIGHT_PX : deltaY
  const step = clamp(pixels, -MAX_WHEEL_STEP_PX, MAX_WHEEL_STEP_PX)
  return Math.exp(-step / WHEEL_PX_PER_E_FOLD)
}

function safariGestureScale(event: Event): number | undefined {
  return 'scale' in event && typeof event.scale === 'number'
    ? event.scale
    : undefined
}

/** Zooms `size` with Ctrl/Cmd + wheel or trackpad pinch over `target` while `isEnabled`; Ctrl/Cmd + wheel never zooms the page. */
export function useThumbnailZoom(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  size: Ref<number>,
  isEnabled: () => boolean
) {
  let pendingFactor = 1
  let frame: number | undefined

  function zoomOnNextFrame(factor: number) {
    pendingFactor *= factor
    frame ??= requestAnimationFrame(() => {
      size.value = zoomThumbnail(size.value, pendingFactor)
      pendingFactor = 1
      frame = undefined
    })
  }

  useEventListener(
    target,
    'wheel',
    (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      if (isEnabled()) zoomOnNextFrame(wheelZoomFactor(event))
    },
    { passive: false }
  )

  let gestureStartSize = size.value
  useEventListener(target, 'gesturestart', (event: Event) => {
    event.preventDefault()
    gestureStartSize = size.value
  })
  useEventListener(target, 'gesturechange', (event: Event) => {
    event.preventDefault()
    const scale = safariGestureScale(event)
    if (scale !== undefined && isEnabled()) {
      size.value = zoomThumbnail(gestureStartSize, scale)
    }
  })

  tryOnScopeDispose(() => {
    if (frame !== undefined) cancelAnimationFrame(frame)
  })
}
