import { computed } from 'vue'

import { useWidgetHistoryStore } from '@/stores/widgetHistoryStore'
import type { WidgetHistoryScope } from '@/stores/widgetHistoryStore'

const PAINTER_HISTORY_BUDGET_BYTES = 512 * 1024 * 1024
const PAINTER_HISTORY_COMPRESS_MIN_PIXELS = 1_000_000

export interface CanvasRect {
  x: number
  y: number
  width: number
  height: number
}

interface RegionPixels {
  canvas?: HTMLCanvasElement
  png?: Blob
}

interface CanvasRegion extends CanvasRect {
  sequence: number
  pixels: RegionPixels
}

let nextSequence = 0

export function clampCanvasRect(
  rect: CanvasRect,
  canvas: { width: number; height: number }
): CanvasRect | null {
  const x = Math.max(0, Math.floor(rect.x))
  const y = Math.max(0, Math.floor(rect.y))
  const right = Math.min(canvas.width, Math.ceil(rect.x + rect.width))
  const bottom = Math.min(canvas.height, Math.ceil(rect.y + rect.height))
  return right > x && bottom > y
    ? { x, y, width: right - x, height: bottom - y }
    : null
}

function blankCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  return ctx ? { canvas, ctx } : null
}

export function captureCanvasRegion(
  source: HTMLCanvasElement,
  { x, y, width, height }: CanvasRect
): CanvasRegion | null {
  const target = blankCanvas(width, height)
  if (!target) return null
  target.ctx.drawImage(source, x, y, width, height, 0, 0, width, height)
  return Object.freeze({
    x,
    y,
    width,
    height,
    sequence: nextSequence++,
    pixels: { canvas: target.canvas }
  })
}

function isCanvasRegion(value: unknown): value is CanvasRegion {
  if (typeof value !== 'object' || value === null) return false
  const region = value as Record<string, unknown>
  return (
    typeof region.x === 'number' &&
    typeof region.y === 'number' &&
    typeof region.width === 'number' &&
    typeof region.height === 'number' &&
    typeof region.sequence === 'number' &&
    typeof region.pixels === 'object' &&
    region.pixels !== null
  )
}

function regionBytes({ width, height, pixels }: CanvasRegion): number {
  return pixels.canvas ? width * height * 4 : (pixels.png?.size ?? 0)
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

function releaseRegion({ pixels }: CanvasRegion) {
  if (pixels.canvas) releaseCanvas(pixels.canvas)
  pixels.canvas = undefined
  pixels.png = undefined
}

function paintCanvasRegion(
  ctx: CanvasRenderingContext2D,
  { x, y, width, height, pixels }: CanvasRegion
): boolean {
  if (!pixels.canvas) return false
  ctx.save()
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(x, y, width, height)
  ctx.drawImage(pixels.canvas, x, y)
  ctx.restore()
  return true
}

async function decodeBitmap(png: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(png)
  } catch {
    return null
  }
}

async function decodeRegion({
  width,
  height,
  pixels
}: CanvasRegion): Promise<boolean> {
  const png = pixels.png
  const bitmap = png ? await decodeBitmap(png) : null
  if (!bitmap) return false
  const target = blankCanvas(width, height)
  if (target) target.ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  if (!target) return false
  if (pixels.png !== png) {
    releaseCanvas(target.canvas)
    return false
  }
  pixels.canvas = target.canvas
  pixels.png = undefined
  return true
}

function whenIdle(task: () => void) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(task)
  else setTimeout(task, 0)
}

interface UsePainterHistoryOptions {
  scope: () => WidgetHistoryScope | null
  context: () => CanvasRenderingContext2D | null
  onRestore: () => void
  budgetBytes?: number
  compressMinPixels?: number
}

export function usePainterHistory({
  scope,
  context,
  onRestore,
  budgetBytes = PAINTER_HISTORY_BUDGET_BYTES,
  compressMinPixels = PAINTER_HISTORY_COMPRESS_MIN_PIXELS
}: UsePainterHistoryOptions) {
  const store = useWidgetHistoryStore()
  let pending = Promise.resolve()

  function storedRegions() {
    return store
      .storedSteps()
      .flatMap(({ scope, value }) =>
        isCanvasRegion(value) ? [{ scope, region: value }] : []
      )
  }

  function isStored(region: CanvasRegion) {
    return storedRegions().some((stored) => stored.region === region)
  }

  function enforceBudget() {
    const regions = storedRegions().sort(
      (a, b) => a.region.sequence - b.region.sequence
    )
    let total = regions.reduce(
      (sum, { region }) => sum + regionBytes(region),
      0
    )
    for (const { scope, region } of regions) {
      if (total <= budgetBytes) return
      store.dropStep(scope, region)
      total -= regionBytes(region)
      releaseRegion(region)
    }
  }

  function compressLater(region: CanvasRegion) {
    if (region.width * region.height < compressMinPixels) return
    whenIdle(() => {
      const canvas = region.pixels.canvas
      if (!canvas || !isStored(region)) return
      canvas.toBlob((png) => {
        if (!png || region.pixels.canvas !== canvas) return
        region.pixels.png = png
        region.pixels.canvas = undefined
        releaseCanvas(canvas)
      }, 'image/png')
    })
  }

  function keep(region: CanvasRegion) {
    compressLater(region)
    enforceBudget()
  }

  function record(captureBefore: () => CanvasRegion | null) {
    const target = scope()
    const before = target && captureBefore()
    if (!target || !before) return
    store.record(target, before)
    keep(before)
  }

  function swapRegion(
    target: WidgetHistoryScope,
    ctx: CanvasRenderingContext2D,
    next: CanvasRegion,
    direction: 'undo' | 'redo'
  ) {
    const current = captureCanvasRegion(ctx.canvas, next)
    if (!current) return
    const step =
      direction === 'undo'
        ? store.undo(target, current)
        : store.redo(target, current)
    if (!isCanvasRegion(step?.value) || !paintCanvasRegion(ctx, step.value))
      return
    releaseRegion(step.value)
    keep(current)
    onRestore()
  }

  async function travel(direction: 'undo' | 'redo'): Promise<void> {
    const target = scope()
    const ctx = context()
    const next = target && store.peek(target, direction)?.value
    if (!target || !ctx || !isCanvasRegion(next)) return
    if (next.pixels.canvas) return swapRegion(target, ctx, next, direction)
    if (await decodeRegion(next)) return travel(direction)
    store.dropStep(target, next)
  }

  function enqueue(direction: 'undo' | 'redo') {
    const run = pending.then(() => travel(direction))
    pending = run.catch(() => undefined)
    return run
  }

  function discard() {
    const target = scope()
    if (target) store.forget(target)
  }

  const canUndo = computed(() => {
    const target = scope()
    return !!target && store.canUndo(target)
  })
  const canRedo = computed(() => {
    const target = scope()
    return !!target && store.canRedo(target)
  })

  return {
    canUndo,
    canRedo,
    record,
    discard,
    undo: () => enqueue('undo'),
    redo: () => enqueue('redo')
  }
}
