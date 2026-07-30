import { onScopeDispose } from 'vue'
import type { Ref } from 'vue'

import { clamp } from 'es-toolkit'

import type { Bounds } from '@/renderer/core/layout/types'

export const MIN_CROP_SIZE = 16

export type CropResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
export type CropDragMode = 'move' | CropResizeDir

interface UseCropBoxEditorOptions {
  rootEl: Ref<HTMLElement | null>
  sourceWidth: Ref<number>
  sourceHeight: Ref<number>
  isDisabled: () => boolean
  lockedRatio?: Ref<number | null>
}

export function useCropBoxEditor(
  bounds: Ref<Bounds>,
  options: UseCropBoxEditorOptions
) {
  const { rootEl, sourceWidth, sourceHeight, isDisabled, lockedRatio } = options

  let cleanupDrag: (() => void) | null = null

  function freeResize(
    mode: CropResizeDir,
    start: Bounds,
    dx: number,
    dy: number
  ): Bounds {
    const maxW = sourceWidth.value
    const maxH = sourceHeight.value
    let x1 = start.x
    let y1 = start.y
    let x2 = start.x + start.width
    let y2 = start.y + start.height
    if (mode.includes('w'))
      x1 = clamp(Math.round(x1 + dx), 0, x2 - MIN_CROP_SIZE)
    if (mode.includes('e'))
      x2 = clamp(Math.round(x2 + dx), x1 + MIN_CROP_SIZE, maxW)
    if (mode.includes('n'))
      y1 = clamp(Math.round(y1 + dy), 0, y2 - MIN_CROP_SIZE)
    if (mode.includes('s'))
      y2 = clamp(Math.round(y2 + dy), y1 + MIN_CROP_SIZE, maxH)
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
  }

  function lockedWidthFor(
    mode: CropResizeDir,
    start: Bounds,
    free: Bounds,
    ratio: number
  ): number {
    const widthFromHeight = free.height * ratio
    if (mode === 'n' || mode === 's') return widthFromHeight
    if (mode === 'e' || mode === 'w') return free.width
    return Math.abs(free.width - start.width) >=
      Math.abs(widthFromHeight - start.width)
      ? free.width
      : widthFromHeight
  }

  function ratioResize(
    mode: CropResizeDir,
    start: Bounds,
    dx: number,
    dy: number,
    ratio: number
  ): Bounds {
    const maxW = sourceWidth.value
    const maxH = sourceHeight.value
    const free = freeResize(mode, start, dx, dy)

    let width = lockedWidthFor(mode, start, free, ratio)
    let height = width / ratio

    const anchorRight = start.x + start.width
    const anchorBottom = start.y + start.height
    const centerX = start.x + start.width / 2
    const centerY = start.y + start.height / 2
    const hasW = mode.includes('w')
    const hasE = mode.includes('e')
    const hasN = mode.includes('n')
    const hasS = mode.includes('s')

    const availWidth = hasW
      ? anchorRight
      : hasE
        ? maxW - start.x
        : 2 * Math.min(centerX, maxW - centerX)
    const availHeight = hasN
      ? anchorBottom
      : hasS
        ? maxH - start.y
        : 2 * Math.min(centerY, maxH - centerY)

    const minWidth = Math.max(MIN_CROP_SIZE, MIN_CROP_SIZE * ratio)
    const scale = Math.min(1, availWidth / width, availHeight / height)
    width = Math.max(width * scale, minWidth)
    height = width / ratio

    width = Math.round(width)
    height = Math.round(height)

    const x = hasW
      ? anchorRight - width
      : hasE
        ? start.x
        : Math.round(centerX - width / 2)
    const y = hasN
      ? anchorBottom - height
      : hasS
        ? start.y
        : Math.round(centerY - height / 2)

    return {
      x: clamp(x, 0, Math.max(maxW - width, 0)),
      y: clamp(y, 0, Math.max(maxH - height, 0)),
      width,
      height
    }
  }

  function applyDrag(
    mode: CropDragMode,
    start: Bounds,
    dx: number,
    dy: number
  ): Bounds {
    const maxW = sourceWidth.value
    const maxH = sourceHeight.value

    if (mode === 'move') {
      return {
        x: clamp(Math.round(start.x + dx), 0, Math.max(maxW - start.width, 0)),
        y: clamp(Math.round(start.y + dy), 0, Math.max(maxH - start.height, 0)),
        width: start.width,
        height: start.height
      }
    }

    const ratio = lockedRatio?.value
    return ratio != null
      ? ratioResize(mode, start, dx, dy, ratio)
      : freeResize(mode, start, dx, dy)
  }

  function startDrag(mode: CropDragMode, event: PointerEvent) {
    if (isDisabled() || event.button !== 0) return
    const root = rootEl.value
    const target = event.currentTarget
    if (!root || !(target instanceof HTMLElement)) return
    if (sourceWidth.value <= 0 || sourceHeight.value <= 0) return

    cleanupDrag?.()

    const rect = root.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const scaleX = sourceWidth.value / rect.width
    const scaleY = sourceHeight.value / rect.height
    const start = { ...bounds.value }
    const startX = event.clientX
    const startY = event.clientY

    target.setPointerCapture(event.pointerId)

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) * scaleX
      const dy = (moveEvent.clientY - startY) * scaleY
      bounds.value = applyDrag(mode, start, dx, dy)
    }

    const endDrag = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', endDrag)
      target.removeEventListener('lostpointercapture', endDrag)
      cleanupDrag = null
    }

    cleanupDrag = endDrag

    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', endDrag)
    target.addEventListener('lostpointercapture', endDrag)
  }

  onScopeDispose(() => {
    cleanupDrag?.()
  })

  return { startDrag }
}
