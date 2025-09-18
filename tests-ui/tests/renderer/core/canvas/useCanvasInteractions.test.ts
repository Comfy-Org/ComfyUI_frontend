import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'

// Mock stores
vi.mock('@/renderer/core/canvas/canvasStore', () => {
  const getCanvas = vi.fn()
  const setCursorStyle = vi.fn()
  return {
    useCanvasStore: vi.fn(() => ({
      getCanvas,
      setCursorStyle
    }))
  }
})
vi.mock('@/platform/settings/settingStore', () => {
  const getFn = vi.fn()
  return { useSettingStore: vi.fn(() => ({ get: getFn })) }
})
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      canvas: {
        dispatchEvent: vi.fn()
      }
    }
  }
}))

function createMockLGraphCanvas(read_only = true): LGraphCanvas {
  const mockCanvas: Partial<LGraphCanvas> = { read_only }
  return mockCanvas as LGraphCanvas
}

function createMockPointerEvent(
  buttons: PointerEvent['buttons'] = 1
): PointerEvent {
  const mockEvent: Partial<PointerEvent> = {
    buttons,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
  return mockEvent as PointerEvent
}

function createMockWheelEvent(ctrlKey = false, metaKey = false): WheelEvent {
  const mockEvent: Partial<WheelEvent> = {
    ctrlKey,
    metaKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
  return mockEvent as WheelEvent
}

describe('useCanvasInteractions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('handlePointer', () => {
    it('should intercept left mouse events when canvas is read_only to enable space+drag navigation', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(true)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)

      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1) // Left Mouse Button
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should forward middle mouse button events to canvas', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(false)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(4) // Middle mouse button
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should not prevent default when canvas is not in read_only mode and not middle button', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(false)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1)
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })

    it('should return early when canvas is null', () => {
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(null as unknown as LGraphCanvas) // TODO: Fix misaligned types
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1)
      handlePointer(mockEvent)

      expect(getCanvas).toHaveBeenCalled()
      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })
  })

  describe('handleWheel', () => {
    it('should forward ctrl+wheel events to canvas in standard nav mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const { handleWheel } = useCanvasInteractions()

      // Ctrl key pressed
      const mockEvent = createMockWheelEvent(true)

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should forward all wheel events to canvas in legacy nav mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')
      const { handleWheel } = useCanvasInteractions()

      const mockEvent = createMockWheelEvent()
      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should not prevent default for regular wheel events in standard nav mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')
      const { handleWheel } = useCanvasInteractions()

      const mockEvent = createMockWheelEvent()
      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })
  })
})
