import { tryOnScopeDispose, useEventListener } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import type { Serializer } from '@vueuse/core'
import type { MaybeRefOrGetter, Ref } from 'vue'

/** Thumbnail tile width range in CSS pixels. */
export const THUMBNAIL_SIZE = { min: 64, default: 96, max: 400 } as const

const LINE_DELTA_MODE = 1
const LINE_HEIGHT_PX = 16
const PAGE_DELTA_MODE = 2
const PAGE_HEIGHT_PX = 800
const MAX_WHEEL_STEP_PX = 50
const WHEEL_PX_PER_E_FOLD = 200

/** `size` scaled by `factor`, kept within {@link THUMBNAIL_SIZE}. */
export function zoomThumbnail(size: number, factor: number): number {
  return clamp(size * factor, THUMBNAIL_SIZE.min, THUMBNAIL_SIZE.max)
}

/** Stored thumbnail size; unreadable values load as the default and out-of-range values are clamped. */
export const thumbnailSizeSerializer: Serializer<number> = {
  read: (raw) => {
    const size = Number.parseFloat(raw)
    return Number.isFinite(size)
      ? zoomThumbnail(size, 1)
      : THUMBNAIL_SIZE.default
  },
  write: String
}

/** Scale factor for one Ctrl/Cmd + wheel event: trackpad pinches zoom smoothly, mouse notches by about a fifth. */
export function wheelZoomFactor({
  deltaY,
  deltaMode
}: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  const pixelsPerUnit =
    deltaMode === PAGE_DELTA_MODE
      ? PAGE_HEIGHT_PX
      : deltaMode === LINE_DELTA_MODE
        ? LINE_HEIGHT_PX
        : 1
  const pixels = deltaY * pixelsPerUnit
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
