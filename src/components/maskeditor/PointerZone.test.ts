import { render, screen } from '@testing-library/vue'
import { reactive, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { usePanAndZoom } from '@/composables/maskeditor/usePanAndZoom'
import type { useToolManager } from '@/composables/maskeditor/useToolManager'

import PointerZone from '@/components/maskeditor/PointerZone.vue'

type ToolManager = ReturnType<typeof useToolManager>
type PanZoom = ReturnType<typeof usePanAndZoom>

const initialMock = () =>
  reactive({
    pointerZone: null as HTMLElement | null,
    isPanning: false,
    brushVisible: true
  })

let mockStore: ReturnType<typeof initialMock>

const mockToolManager = vi.hoisted(() => ({
  handlePointerDown: vi.fn().mockResolvedValue(undefined),
  handlePointerMove: vi.fn().mockResolvedValue(undefined),
  handlePointerUp: vi.fn().mockResolvedValue(undefined),
  updateCursor: vi.fn()
}))

const mockPanZoom = vi.hoisted(() => ({
  handleTouchStart: vi.fn(),
  handleTouchMove: vi.fn().mockResolvedValue(undefined),
  handleTouchEnd: vi.fn(),
  zoom: vi.fn().mockResolvedValue(undefined),
  updateCursorPosition: vi.fn()
}))

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: () => mockStore
}))

const renderZone = () =>
  render(PointerZone, {
    props: {
      toolManager: mockToolManager as unknown as ToolManager,
      panZoom: mockPanZoom as unknown as PanZoom
    }
  })

const getZone = (): HTMLDivElement =>
  screen.getByTestId('pointer-zone') as HTMLDivElement

describe('PointerZone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore = initialMock()
  })

  describe('mount', () => {
    it('should expose its root element to the store on mount', () => {
      renderZone()
      expect(mockStore.pointerZone).toBe(getZone())
    })
  })

  describe('pointer event forwarding', () => {
    it.each([
      ['pointerdown', 'handlePointerDown'],
      ['pointermove', 'handlePointerMove'],
      ['pointerup', 'handlePointerUp']
    ] as const)(
      'should forward %s to toolManager.%s',
      async (eventName, handlerName) => {
        renderZone()
        const zone = getZone()

        zone.dispatchEvent(new Event(eventName, { bubbles: true }))
        await nextTick()

        expect(mockToolManager[handlerName]).toHaveBeenCalledTimes(1)
      }
    )

    it('should hide brush and clear cursor on pointerleave', () => {
      renderZone()
      const zone = getZone()
      zone.style.cursor = 'crosshair'
      mockStore.brushVisible = true

      zone.dispatchEvent(new Event('pointerleave', { bubbles: true }))

      expect(mockStore.brushVisible).toBe(false)
      expect(zone.style.cursor).toBe('')
    })

    it('should call toolManager.updateCursor on pointerenter', () => {
      renderZone()
      const zone = getZone()

      zone.dispatchEvent(new Event('pointerenter', { bubbles: true }))

      expect(mockToolManager.updateCursor).toHaveBeenCalledTimes(1)
    })
  })

  describe('touch event forwarding', () => {
    it.each([
      ['touchstart', 'handleTouchStart'],
      ['touchmove', 'handleTouchMove'],
      ['touchend', 'handleTouchEnd']
    ] as const)(
      'should forward %s to panZoom.%s',
      async (eventName, handlerName) => {
        renderZone()
        const zone = getZone()

        zone.dispatchEvent(new Event(eventName, { bubbles: true }))
        await nextTick()

        expect(mockPanZoom[handlerName]).toHaveBeenCalledTimes(1)
      }
    )
  })

  describe('wheel handling', () => {
    it('should call panZoom.zoom and update cursor position with the wheel coords', async () => {
      renderZone()
      const zone = getZone()

      const event = new WheelEvent('wheel', { bubbles: true, deltaY: -1 })
      // happy-dom doesn't propagate clientX/clientY through the WheelEvent
      // constructor, so set them directly on the event instance.
      Object.defineProperty(event, 'clientX', { value: 123 })
      Object.defineProperty(event, 'clientY', { value: 45 })
      zone.dispatchEvent(event)
      // Flush awaited zoom() then the follow-up updateCursorPosition call
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockPanZoom.zoom).toHaveBeenCalledTimes(1)
      expect(mockPanZoom.updateCursorPosition).toHaveBeenCalledWith({
        x: 123,
        y: 45
      })
    })
  })

  describe('isPanning watcher', () => {
    it('should set cursor to "grabbing" when panning starts', async () => {
      renderZone()
      const zone = getZone()

      mockStore.isPanning = true
      await nextTick()

      expect(zone.style.cursor).toBe('grabbing')
    })

    it('should call toolManager.updateCursor when panning ends', async () => {
      renderZone()

      mockStore.isPanning = true
      await nextTick()
      mockToolManager.updateCursor.mockClear()
      mockStore.isPanning = false
      await nextTick()

      expect(mockToolManager.updateCursor).toHaveBeenCalledTimes(1)
    })
  })

  describe('contextmenu', () => {
    it('should prevent default on contextmenu', () => {
      renderZone()
      const zone = getZone()

      const event = new Event('contextmenu', {
        bubbles: true,
        cancelable: true
      })
      zone.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
    })
  })
})
