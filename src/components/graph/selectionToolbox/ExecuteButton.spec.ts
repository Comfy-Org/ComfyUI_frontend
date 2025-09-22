import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ExecuteButton from '@/components/graph/selectionToolbox/ExecuteButton.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

// Mock the stores
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: vi.fn()
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn()
}))

// Mock the utils
vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn((node) => !!node?.type)
}))

vi.mock('@/utils/nodeFilterUtil', () => ({
  isOutputNode: vi.fn((node) => !!node?.constructor?.nodeData?.output_node)
}))

// Mock the composables
vi.mock('@/composables/graph/useSelectionState', () => ({
  useSelectionState: vi.fn(() => ({
    selectedNodes: {
      value: []
    }
  }))
}))

describe('ExecuteButton', () => {
  let mockCanvas: any
  let mockCanvasStore: any
  let mockCommandStore: any
  let mockSelectedNodes: any[]

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        selectionToolbox: {
          executeButton: {
            tooltip: 'Execute selected nodes'
          }
        }
      }
    }
  })

  beforeEach(async () => {
    setActivePinia(createPinia())

    // Reset mocks
    mockCanvas = {
      setDirty: vi.fn()
    }

    mockSelectedNodes = []

    mockCanvasStore = {
      getCanvas: vi.fn(() => mockCanvas),
      selectedItems: []
    }

    mockCommandStore = {
      execute: vi.fn()
    }

    // Setup store mocks
    vi.mocked(useCanvasStore).mockReturnValue(mockCanvasStore as any)
    vi.mocked(useCommandStore).mockReturnValue(mockCommandStore as any)

    // Update the useSelectionState mock
    const { useSelectionState } = vi.mocked(
      await import('@/composables/graph/useSelectionState')
    )
    useSelectionState.mockReturnValue({
      selectedNodes: {
        value: mockSelectedNodes
      }
    } as any)

    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(ExecuteButton, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        stubs: {
          'i-lucide:play': { template: '<div class="play-icon" />' }
        }
      }
    })
  }

  describe('Rendering', () => {
    it('should be able to render', () => {
      const wrapper = mountComponent()
      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
    })
  })

  describe('Click Handler', () => {
    it('should execute Comfy.QueueSelectedOutputNodes command on click', async () => {
      const wrapper = mountComponent()
      const button = wrapper.find('button')

      await button.trigger('click')

      expect(mockCommandStore.execute).toHaveBeenCalledWith(
        'Comfy.QueueSelectedOutputNodes'
      )
      expect(mockCommandStore.execute).toHaveBeenCalledTimes(1)
    })
  })
})
