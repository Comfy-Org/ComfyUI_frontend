import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ExecuteButton from '@/components/graph/selectionToolbox/ExecuteButton.vue'

const mockLGraphNode = {
  constructor: {
    nodeData: {
      output_node: true
    }
  },
  type: 'TestNode',
  title: 'Test Node',
  hasOutputs: vi.fn(() => true),
  isExecutionNode: vi.fn(() => true)
}

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => true)
}))

// Mock canvas
const mockCanvas = {
  setDirty: vi.fn()
}

vi.mock('@/stores/graphStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => mockCanvas,
    selectedItems: [],
    nodeSelected: true
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: vi.fn()
  })
}))

describe('ExecuteButton', () => {
  let canvasStore: any

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        selectionToolbox: {
          executeButton: {
            tooltip: 'Execute selected nodes',
            disabledTooltip: 'No executable nodes selected'
          }
        }
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = {
      getCanvas: () => mockCanvas,
      selectedItems: [],
      nodeSelected: true
    }

    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(ExecuteButton, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        stubs: {
          'i-lucide:play': true
        }
      }
    })
  }

  it('should render execute button', () => {
    canvasStore.selectedItems = [mockLGraphNode] as any
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })

  it('should be disabled when no executable nodes are selected', () => {
    canvasStore.selectedItems = []
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('should be enabled when executable nodes are selected', () => {
    canvasStore.selectedItems = [mockLGraphNode] as any
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBe('')
  })
})
