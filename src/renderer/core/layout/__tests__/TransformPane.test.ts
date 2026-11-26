import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  createMockCanvas,
  createMockCanvasRenderingContext2D,
  createTestCanvasElement,
  stubCanvasGetContext
} from '@/utils/__tests__/canvasTestUtils'

import TransformPane from '@/renderer/core/layout/transform/TransformPane.vue'

function createMockLGraphCanvas() {
  return createMockCanvas({
    canvas: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    },
    ds: {
      offset: [0, 0],
      scale: 1
    }
  })
}

describe('TransformPane', () => {
  describe('component mounting', () => {
    it('should apply transform style from composable', async () => {
      const mockCanvas = createMockLGraphCanvas()
      mockCanvas.ds.scale = 2
      mockCanvas.ds.offset = [100, 50]
      render(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })
      await nextTick()

      const transformPane = screen.getByTestId('transform-pane')
      expect(transformPane.getAttribute('style')).toContain(
        'transform: scale3d(2, 2, 2) translate3d(100px, 50px, 0)'
      )
    })

    it('should render slot content', () => {
      const mockCanvas = createMockLGraphCanvas()
      render(TransformPane, {
        props: {
          canvas: mockCanvas
        },
        slots: {
          default: '<div class="test-content">Test Node</div>'
        }
      })

      expect(screen.getByText('Test Node')).toBeInTheDocument()
    })
  })

  describe('canvas presentation', () => {
    it('presents camera changes only after drawing, including after canvas element replacement', async () => {
      stubCanvasGetContext()
      const ctx = createMockCanvasRenderingContext2D({ drawImage: vi.fn() })
      const canvas = new LGraphCanvas(
        createTestCanvasElement({ ctx }),
        new LGraph(),
        { skip_render: true, skip_events: true }
      )
      render(TransformPane, {
        props: {
          canvas
        }
      })
      await nextTick()
      const transformPane = screen.getByTestId('transform-pane')

      canvas.ds.offset = [37, -19]
      canvas.ds.scale = 2
      await nextTick()
      expect(transformPane).toHaveStyle({
        transform: 'scale3d(1, 1, 1) translate3d(0px, 0px, 0)'
      })

      canvas.draw()
      await nextTick()
      expect(transformPane).toHaveStyle({
        transform: 'scale3d(2, 2, 2) translate3d(37px, -19px, 0)'
      })

      canvas.setCanvas(createTestCanvasElement({ ctx }), true)
      canvas.ds.offset = [-23, 41]
      await nextTick()
      expect(transformPane).toHaveStyle({
        transform: 'scale3d(2, 2, 2) translate3d(37px, -19px, 0)'
      })

      canvas.draw()
      await nextTick()
      expect(transformPane).toHaveStyle({
        transform: 'scale3d(2, 2, 2) translate3d(-23px, 41px, 0)'
      })
    })
  })

  describe('canvas event listeners', () => {
    it('should add event listeners to canvas on mount', async () => {
      const mockCanvas = createMockLGraphCanvas()
      render(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      await nextTick()

      expect(mockCanvas.canvas.addEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        expect.any(Object)
      )
    })

    it('should remove event listeners on unmount', async () => {
      const mockCanvas = createMockLGraphCanvas()
      const { unmount } = render(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      await nextTick()
      unmount()

      expect(mockCanvas.canvas.removeEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        expect.any(Object)
      )
    })
  })

  describe('interaction state management', () => {
    it('should handle pointer events for node delegation', async () => {
      const mockCanvas = createMockLGraphCanvas()
      render(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      const transformPane = screen.getByTestId('transform-pane')

      /* oxlint-disable testing-library/prefer-user-event -- pointerDown for delegation, not a click */
      await fireEvent.pointerDown(transformPane)
      /* oxlint-enable testing-library/prefer-user-event */

      expect(transformPane).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('should handle null canvas gracefully', () => {
      render(TransformPane, {
        props: {
          canvas: undefined
        }
      })

      expect(screen.getByTestId('transform-pane')).toBeInTheDocument()
    })
  })
})
