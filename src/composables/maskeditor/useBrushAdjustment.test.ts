import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

vi.mock('@/composables/maskeditor/useCoordinateTransform', () => ({
  useCoordinateTransform: () => ({
    screenToCanvas: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y }))
  })
}))

vi.mock('@/scripts/app', () => ({
  app: { registerExtension: vi.fn() }
}))

import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useBrushAdjustment } from './useBrushAdjustment'

function makePointerEvent(offsetX: number, offsetY: number): PointerEvent {
  return {
    offsetX,
    offsetY,
    preventDefault: vi.fn()
  } as unknown as PointerEvent
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  vi.resetAllMocks()
})

describe('startBrushAdjustment', () => {
  it('sets brushPreviewGradientVisible to true', async () => {
    const store = useMaskEditorStore()
    store.brushPreviewGradientVisible = false
    const { startBrushAdjustment } = useBrushAdjustment()
    await startBrushAdjustment(makePointerEvent(100, 100))
    expect(store.brushPreviewGradientVisible).toBe(true)
  })
})

describe('handleBrushAdjustment', () => {
  it('does nothing when startBrushAdjustment has not been called', async () => {
    const store = useMaskEditorStore()
    const sizeBefore = store.brushSettings.size
    const { handleBrushAdjustment } = useBrushAdjustment()
    await handleBrushAdjustment(makePointerEvent(200, 100))
    expect(store.brushSettings.size).toBe(sizeBefore)
  })

  it('does not change size when deltaX is within the dead zone', async () => {
    const store = useMaskEditorStore()
    const { startBrushAdjustment, handleBrushAdjustment } = useBrushAdjustment()
    await startBrushAdjustment(makePointerEvent(100, 100))
    const sizeBefore = store.brushSettings.size
    await handleBrushAdjustment(makePointerEvent(103, 100))
    expect(store.brushSettings.size).toBe(sizeBefore)
  })

  it('increases size when dragging right past the dead zone', async () => {
    const store = useMaskEditorStore()
    const { startBrushAdjustment, handleBrushAdjustment } = useBrushAdjustment()
    await startBrushAdjustment(makePointerEvent(100, 100))
    const sizeBefore = store.brushSettings.size
    await handleBrushAdjustment(makePointerEvent(150, 100))
    expect(store.brushSettings.size).toBeGreaterThan(sizeBefore)
  })

  it('clamps size to minimum 1 when dragging far left', async () => {
    const store = useMaskEditorStore()
    store.brushSettings.size = 1
    const { startBrushAdjustment, handleBrushAdjustment } = useBrushAdjustment()
    await startBrushAdjustment(makePointerEvent(500, 100))
    await handleBrushAdjustment(makePointerEvent(0, 100))
    expect(store.brushSettings.size).toBeGreaterThanOrEqual(1)
  })

  it('clamps hardness to maximum 1 when dragging far up', async () => {
    const store = useMaskEditorStore()
    store.brushSettings.hardness = 1
    const { startBrushAdjustment, handleBrushAdjustment } = useBrushAdjustment()
    await startBrushAdjustment(makePointerEvent(100, 500))
    await handleBrushAdjustment(makePointerEvent(100, 0))
    expect(store.brushSettings.hardness).toBeLessThanOrEqual(1)
  })

  it('suppresses hardness change when X delta dominates (useDominantAxis=true)', async () => {
    const store = useMaskEditorStore()
    store.brushSettings.hardness = 0.5
    const { startBrushAdjustment, handleBrushAdjustment } = useBrushAdjustment({
      useDominantAxis: true
    })
    await startBrushAdjustment(makePointerEvent(0, 0))
    await handleBrushAdjustment(makePointerEvent(100, 10))
    expect(store.brushSettings.hardness).toBe(0.5)
  })
})
