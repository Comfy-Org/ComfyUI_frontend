import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Tools } from '@/extensions/core/maskeditor/types'
import { useToolManager } from '@/composables/maskeditor/useToolManager'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

const handlePanStart = vi.fn()
const handlePanMove = vi.fn(async () => {})
const addPenPointerId = vi.fn()
const updateCursorPosition = vi.fn()

const startDrawing = vi.fn(async () => {})
const handleDrawing = vi.fn(async () => {})
const drawEnd = vi.fn(async () => {})
const startBrushAdjustment = vi.fn(async () => {})
const clearLastColorSelectPoint = vi.fn()

vi.mock('@/scripts/app', () => ({
  app: {
    extensionManager: {
      setting: {
        get: () => undefined
      }
    }
  }
}))

vi.mock('@/composables/maskeditor/useBrushDrawing', () => ({
  useBrushDrawing: () => ({
    startDrawing,
    handleDrawing,
    drawEnd,
    startBrushAdjustment
  })
}))

vi.mock('@/composables/maskeditor/useCanvasTools', () => ({
  useCanvasTools: () => ({
    paintBucketFill: vi.fn(),
    colorSelectFill: vi.fn(async () => {}),
    clearLastColorSelectPoint
  })
}))

vi.mock('@/composables/maskeditor/useCoordinateTransform', () => ({
  useCoordinateTransform: () => ({
    screenToCanvas: (p: { x: number; y: number }) => p
  })
}))

function createKeyboardMock(spaceHeld = false) {
  return {
    isKeyDown: (key: string) => (key === ' ' ? spaceHeld : false)
  } as unknown as Parameters<typeof useToolManager>[0]
}

function createPanZoomMock() {
  return {
    handlePanStart,
    handlePanMove,
    addPenPointerId,
    updateCursorPosition,
    handlePanEnd: vi.fn(),
    handleTouchStart: vi.fn(),
    handleTouchMove: vi.fn(async () => {}),
    handleTouchEnd: vi.fn(),
    zoom: vi.fn(async () => {})
  } as unknown as Parameters<typeof useToolManager>[1]
}

function makePointerEvent(
  type: 'pointerdown' | 'pointermove',
  init: PointerEventInit
) {
  const event = new PointerEvent(type, init)
  // PointerEvent.preventDefault is a no-op in happy-dom, but the handler
  // calls it unconditionally — nothing to assert.
  return event
}

describe('useToolManager MMB pan branch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Reset store state that the handlers toggle.
    const store = useMaskEditorStore()
    store.brushVisible = true
    store.currentTool = Tools.MaskPen
  })

  describe('handlePointerDown', () => {
    it('starts pan and hides brush on middle-button pointerdown', async () => {
      const { handlePointerDown } = useToolManager(
        createKeyboardMock(false),
        createPanZoomMock()
      )
      const store = useMaskEditorStore()

      await handlePointerDown(
        makePointerEvent('pointerdown', { button: 1, buttons: 4 })
      )

      expect(handlePanStart).toHaveBeenCalledTimes(1)
      expect(store.brushVisible).toBe(false)
      expect(startDrawing).not.toHaveBeenCalled()
    })

    it('starts pan on Space + left-button pointerdown', async () => {
      const { handlePointerDown } = useToolManager(
        createKeyboardMock(true),
        createPanZoomMock()
      )

      await handlePointerDown(
        makePointerEvent('pointerdown', { button: 0, buttons: 1 })
      )

      expect(handlePanStart).toHaveBeenCalledTimes(1)
      expect(startDrawing).not.toHaveBeenCalled()
    })

    it('starts drawing on plain left-button pointerdown with drawing tool selected', async () => {
      const { handlePointerDown } = useToolManager(
        createKeyboardMock(false),
        createPanZoomMock()
      )

      await handlePointerDown(
        makePointerEvent('pointerdown', { button: 0, buttons: 1 })
      )

      expect(handlePanStart).not.toHaveBeenCalled()
      expect(startDrawing).toHaveBeenCalledTimes(1)
    })

    it('ignores touch pointerdown', async () => {
      const { handlePointerDown } = useToolManager(
        createKeyboardMock(false),
        createPanZoomMock()
      )

      await handlePointerDown(
        makePointerEvent('pointerdown', {
          button: 1,
          buttons: 4,
          pointerType: 'touch'
        })
      )

      expect(handlePanStart).not.toHaveBeenCalled()
      expect(startDrawing).not.toHaveBeenCalled()
    })

    it('registers pen pointer id before MMB branch runs', async () => {
      const { handlePointerDown } = useToolManager(
        createKeyboardMock(false),
        createPanZoomMock()
      )

      await handlePointerDown(
        makePointerEvent('pointerdown', {
          button: 1,
          buttons: 4,
          pointerType: 'pen'
        })
      )

      expect(addPenPointerId).toHaveBeenCalledTimes(1)
      expect(handlePanStart).toHaveBeenCalledTimes(1)
    })
  })

  describe('handlePointerMove', () => {
    it('continues pan on pointermove while middle is held (buttons=4)', async () => {
      const { handlePointerMove } = useToolManager(
        createKeyboardMock(false),
        createPanZoomMock()
      )

      await handlePointerMove(makePointerEvent('pointermove', { buttons: 4 }))

      expect(handlePanMove).toHaveBeenCalledTimes(1)
    })

    it('does NOT continue pan on pointermove with chorded MMB+LMB (buttons=5, strict semantics)', async () => {
      // useToolManager still uses isMiddlePointerInput (strict on the buttons
      // branch). The chorded case is explicitly out of scope for the pan
      // branch — if callers want the bitmask semantic they should use
      // isMiddleButtonHeld. Pin the current contract.
      const { handlePointerMove } = useToolManager(
        createKeyboardMock(false),
        createPanZoomMock()
      )

      await handlePointerMove(makePointerEvent('pointermove', { buttons: 5 }))

      expect(handlePanMove).not.toHaveBeenCalled()
    })

    it('continues pan on Space + left-button pointermove', async () => {
      const { handlePointerMove } = useToolManager(
        createKeyboardMock(true),
        createPanZoomMock()
      )

      await handlePointerMove(makePointerEvent('pointermove', { buttons: 1 }))

      expect(handlePanMove).toHaveBeenCalledTimes(1)
    })

    it('does not pan on plain left-drag pointermove (no Space, no MMB)', async () => {
      const { handlePointerMove } = useToolManager(
        createKeyboardMock(false),
        createPanZoomMock()
      )

      await handlePointerMove(makePointerEvent('pointermove', { buttons: 1 }))

      expect(handlePanMove).not.toHaveBeenCalled()
    })
  })
})
