import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'
import { Positionable } from '@/lib/litegraph/src/interfaces'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

class MockLGraphNode implements Positionable {
  type = 'TestNode'
  title = 'Test Node'
  mode = LGraphEventMode.ALWAYS
  id = 'node-1'
  pos = new Float64Array([26, 186])
  move = vi.fn()
  snapToGrid = vi.fn()
  boundingRect: [number, number, number, number] = [0, 0, 100, 100]
}

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => true)
}))

describe('BypassButton', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        selectionToolbox: {
          bypassButton: {
            tooltip: 'Bypass/Unbypass Selected Nodes'
          }
        },
        'commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label':
          'Toggle Bypass Selected Nodes'
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    // canvasStore = useCanvasStore()
    // commandStore = useCommandStore()
    // mockLGraphNode = new MockLGraphNode()

    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(BypassButton, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        stubs: {
          'i-lucide:ban': true
        }
      }
    })
  }

  it('should render bypass button', () => {
    const canvasStore = useCanvasStore()
    const mockLGraphNode = new MockLGraphNode()

    canvasStore.selectedItems = [mockLGraphNode]
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })

  it('should have correct test id', () => {
    const canvasStore = useCanvasStore()
    const mockLGraphNode = new MockLGraphNode()

    canvasStore.selectedItems = [mockLGraphNode]
    const wrapper = mountComponent()
    const button = wrapper.find('[data-testid="bypass-button"]')
    expect(button.exists()).toBe(true)
  })

  it('should execute bypass command when clicked', async () => {
    const canvasStore = useCanvasStore()
    const commandStore = useCommandStore()
    const mockLGraphNode = new MockLGraphNode()

    canvasStore.selectedItems = [mockLGraphNode]
    const executeSpy = vi.spyOn(commandStore, 'execute').mockResolvedValue()

    const wrapper = mountComponent()
    await wrapper.find('button').trigger('click')

    expect(executeSpy).toHaveBeenCalledWith(
      'Comfy.Canvas.ToggleSelectedNodes.Bypass'
    )
  })

  it('should handle multiple selected items', () => {
    const canvasStore = useCanvasStore()
    const commandStore = useCommandStore()
    const mockLGraphNode = new MockLGraphNode()

    vi.spyOn(commandStore, 'execute').mockResolvedValue()
    canvasStore.selectedItems = [mockLGraphNode, new MockLGraphNode()]
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })
})
