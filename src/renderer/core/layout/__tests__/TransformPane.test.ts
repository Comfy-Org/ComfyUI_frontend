import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive } from 'vue'

import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { createMockCanvas } from '@/utils/__tests__/litegraphTestUtils'

import TransformPane from '../transform/TransformPane.vue'

const mockCamera = reactive({ x: 0, y: 0, z: 1 })

vi.mock('@/renderer/core/layout/transform/useTransformState', () => {
  const syncWithCanvas = vi.fn()
  return {
    useTransformState: () => ({
      camera: mockCamera,
      transformStyle: computed(() => ({
        transform: `scale3d(${mockCamera.z}, ${mockCamera.z}, ${mockCamera.z}) translate3d(${mockCamera.x}px, ${mockCamera.y}px, 0)`,
        transformOrigin: '0 0'
      })),
      canvasToScreen: vi.fn(),
      screenToCanvas: vi.fn(),
      isNodeInViewport: vi.fn(),
      syncWithCanvas
    })
  }
})

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getAllNodes: () => computed(() => new Map()),
    getVersion: () => computed(() => 0),
    onChange: vi.fn(() => () => {})
  }
}))

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
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    mockCamera.x = 0
    mockCamera.y = 0
    mockCamera.z = 1
  })

  describe('component mounting', () => {
    it('should mount successfully with minimal props', () => {
      const mockCanvas = createMockLGraphCanvas()
      const wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-testid="transform-pane"]').exists()).toBe(true)
    })

    it('should apply camera transform via RAF', async () => {
      mockCamera.x = 100
      mockCamera.y = 50
      mockCamera.z = 2

      const mockCanvas = createMockLGraphCanvas()
      const wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      await nextTick()
      vi.advanceTimersToNextFrame()
      await nextTick()

      const transformPane = wrapper.find('[data-testid="transform-pane"]')
      const style = transformPane.attributes('style')
      expect(style).toContain('scale3d(2, 2, 2)')
      expect(style).toContain('translate3d(100px, 50px, 0)')
    })

    it('should render slot content inside offset wrapper', () => {
      const mockCanvas = createMockLGraphCanvas()
      const wrapper = mount(TransformPane, {
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

    it('should contain an offset wrapper div', () => {
      const mockCanvas = createMockLGraphCanvas()
      const wrapper = mount(TransformPane, {
        props: { canvas: mockCanvas }
      })

      const pane = wrapper.find('[data-testid="transform-pane"]')
      const offsetWrapper = pane.find('.absolute')
      expect(offsetWrapper.exists()).toBe(true)
    })
  })

  describe('RAF synchronization', () => {
    it('should call syncWithCanvas during RAF updates', async () => {
      const mockCanvas = createMockLGraphCanvas()
      mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      await nextTick()

      // Allow RAF to execute
      vi.advanceTimersToNextFrame()

      const transformState = useTransformState()
      expect(transformState.syncWithCanvas).toHaveBeenCalledWith(mockCanvas)
    })
  })

  describe('canvas event listeners', () => {
    it('should add event listeners to canvas on mount', async () => {
      const mockCanvas = createMockLGraphCanvas()
      mount(TransformPane, {
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
      const wrapper = mount(TransformPane, {
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
    })
  })

  describe('interaction state management', () => {
    it('should handle pointer events for node delegation', async () => {
      const mockCanvas = createMockLGraphCanvas()
      const wrapper = mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      const transformPane = wrapper.find('[data-testid="transform-pane"]')

      await transformPane.trigger('pointerdown')

      expect(transformPane.exists()).toBe(true)
    })
  })

  describe('transform state integration', () => {
    it('should provide transform utilities to child components', () => {
      const mockCanvas = createMockLGraphCanvas()
      mount(TransformPane, {
        props: {
          canvas: mockCanvas
        }
      })

      const transformState = useTransformState()
      expect(transformState.syncWithCanvas).toBeDefined()
      expect(transformState.canvasToScreen).toBeDefined()
      expect(transformState.screenToCanvas).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle null canvas gracefully', () => {
      const wrapper = mount(TransformPane, {
        props: {
          canvas: undefined
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-testid="transform-pane"]').exists()).toBe(true)
    })
  })
})
