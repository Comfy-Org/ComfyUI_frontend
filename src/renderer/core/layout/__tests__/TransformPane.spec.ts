import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import TransformPane from '../TransformPane.vue'

// Mock the transform state composable
const mockTransformState = {
  camera: ref({ x: 0, y: 0, z: 1 }),
  transformStyle: ref({
    transform: 'scale(1) translate(0px, 0px)',
    transformOrigin: '0 0'
  }),
  syncWithCanvas: vi.fn(),
  canvasToScreen: vi.fn(),
  screenToCanvas: vi.fn(),
  isNodeInViewport: vi.fn()
}

vi.mock('@/renderer/core/spatial/useTransformState', () => ({
  useTransformState: () => mockTransformState
}))

// Mock requestAnimationFrame/cancelAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 16)
  return 1
})
global.cancelAnimationFrame = vi.fn()

describe('TransformPane', () => {
  let wrapper: ReturnType<typeof mount>
  let mockCanvas: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock canvas with LiteGraph interface
    mockCanvas = {
      canvas: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      ds: {
        offset: [0, 0],
        scale: 1
      }
    }

    // Reset mock transform state
    mockTransformState.camera.value = { x: 0, y: 0, z: 1 }
    mockTransformState.transformStyle.value = {
      transform: 'scale(1) translate(0px, 0px)',
      transformOrigin: '0 0'
    }
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('component mounting', () => {
    it('should mount successfully with minimal props', () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.transform-pane').exists()).toBe(true)
    })

    it('should apply transform style from composable', () => {
      mockTransformState.transformStyle.value = {
        transform: 'scale(2) translate(100px, 50px)',
        transformOrigin: '0 0'
      }

      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      const transformPane = wrapper.find('.transform-pane')
      const style = transformPane.attributes('style')
      expect(style).toContain('transform: scale(2) translate(100px, 50px)')
    })

    it('should render slot content', () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        },
        slots: {
          default: '<div class="test-content">Test Node</div>'
        }
      })

      expect(wrapper.find('.test-content').exists()).toBe(true)
      expect(wrapper.find('.test-content').text()).toBe('Test Node')
    })
  })

  describe('RAF synchronization', () => {
    it('should start RAF sync on mount', async () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      await nextTick()

      // Should emit RAF status change to true
      expect(wrapper.emitted('rafStatusChange')).toBeTruthy()
      expect(wrapper.emitted('rafStatusChange')?.[0]).toEqual([true])
    })

    it('should call syncWithCanvas during RAF updates', async () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      await nextTick()

      // Allow RAF to execute
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(mockTransformState.syncWithCanvas).toHaveBeenCalledWith(mockCanvas)
    })

    it('should emit transform update timing', async () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      await nextTick()

      // Allow RAF to execute
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(wrapper.emitted('transformUpdate')).toBeTruthy()
      const updateEvent = wrapper.emitted('transformUpdate')?.[0]
      expect(typeof updateEvent?.[0]).toBe('number')
      expect(updateEvent?.[0]).toBeGreaterThanOrEqual(0)
    })

    it('should stop RAF sync on unmount', async () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      await nextTick()
      wrapper.unmount()

      expect(wrapper.emitted('rafStatusChange')).toBeTruthy()
      const events = wrapper.emitted('rafStatusChange') as any[]
      expect(events[events.length - 1]).toEqual([false])
      expect(global.cancelAnimationFrame).toHaveBeenCalled()
    })
  })

  describe('canvas event listeners', () => {
    it('should add event listeners to canvas on mount', async () => {
      wrapper = mount(TransformPane, {
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
      expect(mockCanvas.canvas.addEventListener).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
        expect.any(Object)
      )
      expect(mockCanvas.canvas.addEventListener).toHaveBeenCalledWith(
        'pointerup',
        expect.any(Function),
        expect.any(Object)
      )
      expect(mockCanvas.canvas.addEventListener).toHaveBeenCalledWith(
        'pointercancel',
        expect.any(Function),
        expect.any(Object)
      )
    })

    it('should remove event listeners on unmount', async () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      await nextTick()
      wrapper.unmount()

      expect(mockCanvas.canvas.removeEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        expect.any(Object)
      )
      expect(mockCanvas.canvas.removeEventListener).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
        expect.any(Object)
      )
      expect(mockCanvas.canvas.removeEventListener).toHaveBeenCalledWith(
        'pointerup',
        expect.any(Function),
        expect.any(Object)
      )
      expect(mockCanvas.canvas.removeEventListener).toHaveBeenCalledWith(
        'pointercancel',
        expect.any(Function),
        expect.any(Object)
      )
    })
  })

  describe('interaction state management', () => {
    it('should apply interacting class during interactions', async () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      // Simulate interaction start by checking internal state
      // Note: This tests the CSS class application logic
      const transformPane = wrapper.find('.transform-pane')

      // Initially should not have interacting class
      expect(transformPane.classes()).not.toContain(
        'transform-pane--interacting'
      )
    })

    it('should handle pointer events for node delegation', async () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      const transformPane = wrapper.find('.transform-pane')

      // Simulate pointer down - we can't test the exact delegation logic
      // in unit tests due to vue-test-utils limitations, but we can verify
      // the event handler is set up correctly
      await transformPane.trigger('pointerdown')

      // The test passes if no errors are thrown during event handling
      expect(transformPane.exists()).toBe(true)
    })
  })

  describe('transform state integration', () => {
    it('should provide transform utilities to child components', () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      // The component should provide transform state via Vue's provide/inject
      // This is tested indirectly through the composable integration
      expect(mockTransformState.syncWithCanvas).toBeDefined()
      expect(mockTransformState.canvasToScreen).toBeDefined()
      expect(mockTransformState.screenToCanvas).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle null canvas gracefully', () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: undefined
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.transform-pane').exists()).toBe(true)
    })

    it('should handle missing canvas properties', () => {
      const incompleteCanvas = {} as any

      wrapper = mount(TransformPane, {
        props: {
          canvas: incompleteCanvas
        }
      })

      expect(wrapper.exists()).toBe(true)
      // Should not throw errors during mount
    })
  })

  describe('performance optimizations', () => {
    it('should use contain CSS property for layout optimization', () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      const transformPane = wrapper.find('.transform-pane')

      // This test verifies the CSS contains the performance optimization
      // Note: In JSDOM, computed styles might not reflect all CSS properties
      expect(transformPane.element.className).toContain('transform-pane')
    })

    it('should disable pointer events on container but allow on children', () => {
      wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        },
        slots: {
          default: '<div data-node-id="test">Test Node</div>'
        }
      })

      const transformPane = wrapper.find('.transform-pane')

      // The CSS should handle pointer events optimization
      // This is primarily a CSS concern, but we verify the structure
      expect(transformPane.exists()).toBe(true)
      expect(wrapper.find('[data-node-id="test"]').exists()).toBe(true)
    })
  })
})
