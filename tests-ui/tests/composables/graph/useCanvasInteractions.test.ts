import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasInteractions } from '@/composables/graph/useCanvasInteractions'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

// Mock stores
vi.mock('@/stores/graphStore', () => {
  const getCanvas = vi.fn()
  return { useCanvasStore: vi.fn(() => ({ getCanvas })) }
})
vi.mock('@/stores/settingStore', () => {
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

describe('useCanvasInteractions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('handlePointer', () => {
    it('should forward space+drag events to canvas when read_only is true', () => {
      // Setup
      const mockCanvas: Partial<LGraphCanvas> = { read_only: true }
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(mockCanvas as LGraphCanvas)

      const { handlePointer } = useCanvasInteractions()

      // Create mock pointer event
      const mockEvent: Partial<PointerEvent> = {
        buttons: 1, // Left mouse button
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }

      // Test
      handlePointer(mockEvent as PointerEvent)

      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should forward middle mouse button events to canvas', () => {
      // Setup
      const mockCanvas: Partial<LGraphCanvas> = { read_only: false }
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(mockCanvas as LGraphCanvas)

      const { handlePointer } = useCanvasInteractions()

      // Create mock pointer event with middle button
      const mockEvent: Partial<PointerEvent> = {
        buttons: 4, // Middle mouse button
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }

      // Test
      handlePointer(mockEvent as PointerEvent)

      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should not prevent default when canvas is not in read_only mode and not middle button', () => {
      // Setup
      const mockCanvas: Partial<LGraphCanvas> = { read_only: false }
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(mockCanvas as LGraphCanvas)

      const { handlePointer } = useCanvasInteractions()

      // Create mock pointer event
      const mockEvent: Partial<PointerEvent> = {
        buttons: 1, // Left mouse button
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }

      // Test
      handlePointer(mockEvent as PointerEvent)

      // Verify - should not prevent default (let media handle normally)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })

    it('should return early when canvas is null', () => {
      // Setup
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(null as unknown as LGraphCanvas) // TODO: Fix misaligned types

      const { handlePointer } = useCanvasInteractions()

      // Create mock pointer event that would normally trigger forwarding
      const mockEvent: Partial<PointerEvent> = {
        buttons: 1, // Left mouse button - would trigger space+drag if canvas had read_only=true
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }

      // Test
      handlePointer(mockEvent as PointerEvent)

      // Verify early return - no event methods should be called at all
      expect(getCanvas).toHaveBeenCalled()
      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })
  })

  describe('handleWheel', () => {
    it('should forward ctrl+wheel events to canvas in standard nav mode', () => {
      // Setup
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const { handleWheel } = useCanvasInteractions()

      // Create mock wheel event with ctrl key
      const mockEvent: Partial<WheelEvent> = {
        ctrlKey: true,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }

      // Test
      handleWheel(mockEvent as WheelEvent)

      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled()
    })

    it('should forward all wheel events to canvas in legacy nav mode', () => {
      // Setup
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')

      const { handleWheel } = useCanvasInteractions()

      // Create mock wheel event without modifiers
      const mockEvent: Partial<WheelEvent> = {
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }

      // Test
      handleWheel(mockEvent as WheelEvent)

      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled()
    })

    it('should not prevent default for regular wheel events in standard nav mode', () => {
      // Setup
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const { handleWheel } = useCanvasInteractions()

      // Create mock wheel event without modifiers
      const mockEvent: Partial<WheelEvent> = {
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }

      // Test
      handleWheel(mockEvent as WheelEvent)

      // Verify - should not prevent default (let component handle normally)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
    })
  })
})
