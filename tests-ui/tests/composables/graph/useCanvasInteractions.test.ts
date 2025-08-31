import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasInteractions } from '@/composables/graph/useCanvasInteractions'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

// Mock stores
vi.mock('@/stores/graphStore')
vi.mock('@/stores/settingStore')
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      canvas: {
        dispatchEvent: vi.fn()
      }
    }
  }
}))

describe('useCanvasInteractions', () => {
  const mockGetCanvas = vi.fn()
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockReturnValue({
      getCanvas: mockGetCanvas
    } as any)
    vi.mocked(useSettingStore).mockReturnValue({
      get: mockGet
    } as any)
  })

  describe('handlePointer', () => {
    it('should forward space+drag events to canvas when read_only is true', () => {
      // Setup
      const mockCanvas = { read_only: true }
      mockGetCanvas.mockReturnValue(mockCanvas)

      const { handlePointer } = useCanvasInteractions()

      // Create mock pointer event
      const mockEvent = {
        buttons: 1, // Left mouse button
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      } as unknown as PointerEvent

      // Test
      handlePointer(mockEvent)

      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should forward middle mouse button events to canvas', () => {
      // Setup
      const mockCanvas = { read_only: false }
      mockGetCanvas.mockReturnValue(mockCanvas)

      const { handlePointer } = useCanvasInteractions()

      // Create mock pointer event with middle button
      const mockEvent = {
        buttons: 4, // Middle mouse button
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      } as unknown as PointerEvent

      // Test
      handlePointer(mockEvent)

      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should not prevent default when canvas is not in read_only mode and not middle button', () => {
      // Setup
      const mockCanvas = { read_only: false }
      mockGetCanvas.mockReturnValue(mockCanvas)

      const { handlePointer } = useCanvasInteractions()

      // Create mock pointer event
      const mockEvent = {
        buttons: 1, // Left mouse button
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      } as unknown as PointerEvent

      // Test
      handlePointer(mockEvent)

      // Verify - should not prevent default (let media handle normally)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })

    it('should handle missing canvas gracefully', () => {
      // Setup
      mockGetCanvas.mockReturnValue(null)

      const { handlePointer } = useCanvasInteractions()

      // Create mock pointer event
      const mockEvent = {
        buttons: 1,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      } as unknown as PointerEvent

      // Test - should not throw
      expect(() => handlePointer(mockEvent)).not.toThrow()

      // Verify
      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe('handleWheel', () => {
    it('should forward ctrl+wheel events to canvas in standard nav mode', () => {
      // Setup
      mockGet.mockReturnValue('standard')

      const { handleWheel } = useCanvasInteractions()

      // Create mock wheel event with ctrl key
      const mockEvent = {
        ctrlKey: true,
        metaKey: false,
        preventDefault: vi.fn()
      } as unknown as WheelEvent

      // Test
      handleWheel(mockEvent)

      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled()
    })

    it('should forward all wheel events to canvas in legacy nav mode', () => {
      // Setup
      mockGet.mockReturnValue('legacy')

      const { handleWheel } = useCanvasInteractions()

      // Create mock wheel event without modifiers
      const mockEvent = {
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      } as unknown as WheelEvent

      // Test
      handleWheel(mockEvent)

      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled()
    })

    it('should not prevent default for regular wheel events in standard nav mode', () => {
      // Setup
      mockGet.mockReturnValue('standard')

      const { handleWheel } = useCanvasInteractions()

      // Create mock wheel event without modifiers
      const mockEvent = {
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      } as unknown as WheelEvent

      // Test
      handleWheel(mockEvent)

      // Verify - should not prevent default (let component handle normally)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
    })
  })
})
