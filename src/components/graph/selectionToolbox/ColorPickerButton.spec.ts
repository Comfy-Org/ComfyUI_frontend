import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

// Import after mocks
import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import { useCanvasStore } from '@/stores/graphStore'
import { useWorkflowStore } from '@/stores/workflowStore'

// Mock the litegraph module
vi.mock('@/lib/litegraph/src/litegraph', async () => {
  const actual = await vi.importActual('@/lib/litegraph/src/litegraph')
  return {
    ...actual,
    LGraphCanvas: {
      node_colors: {
        red: { bgcolor: '#ff0000' },
        green: { bgcolor: '#00ff00' },
        blue: { bgcolor: '#0000ff' }
      }
    },
    LiteGraph: {
      NODE_DEFAULT_BGCOLOR: '#353535'
    },
    isColorable: vi.fn(() => true)
  }
})

// Mock the colorUtil module
vi.mock('@/utils/colorUtil', () => ({
  adjustColor: vi.fn((color: string) => color + '_light')
}))

// Mock the litegraphUtil module
vi.mock('@/utils/litegraphUtil', () => ({
  getItemsColorOption: vi.fn(() => null),
  isLGraphNode: vi.fn((item) => item?.type === 'LGraphNode'),
  isLGraphGroup: vi.fn((item) => item?.type === 'LGraphGroup'),
  isReroute: vi.fn(() => false)
}))

describe('ColorPickerButton', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let workflowStore: ReturnType<typeof useWorkflowStore>

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        color: {
          noColor: 'No Color',
          red: 'Red',
          green: 'Green',
          blue: 'Blue'
        }
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    workflowStore = useWorkflowStore()

    // Set up default store state
    canvasStore.selectedItems = []

    // Mock workflow store
    workflowStore.activeWorkflow = {
      changeTracker: {
        checkState: vi.fn()
      }
    } as any
  })

  const createWrapper = () => {
    return mount(ColorPickerButton, {
      global: {
        plugins: [PrimeVue, i18n],
        directives: {
          tooltip: Tooltip
        }
      }
    })
  }

  it('should render when nodes are selected', () => {
    // Add a mock node to selectedItems
    canvasStore.selectedItems = [{ type: 'LGraphNode' } as any]
    const wrapper = createWrapper()
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('should not render when nothing is selected', () => {
    // Keep selectedItems empty
    canvasStore.selectedItems = []
    const wrapper = createWrapper()
    // The button exists but is hidden with v-show
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('button').attributes('style')).toContain(
      'display: none'
    )
  })

  it('should toggle color picker visibility on button click', async () => {
    canvasStore.selectedItems = [{ type: 'LGraphNode' } as any]
    const wrapper = createWrapper()
    const button = wrapper.find('button')

    expect(wrapper.find('.color-picker-container').exists()).toBe(false)

    await button.trigger('click')
    expect(wrapper.find('.color-picker-container').exists()).toBe(true)

    await button.trigger('click')
    expect(wrapper.find('.color-picker-container').exists()).toBe(false)
  })
})
