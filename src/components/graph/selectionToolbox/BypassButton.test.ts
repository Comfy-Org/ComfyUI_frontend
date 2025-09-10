import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'
import { LGraphEventMode, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

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
    vi.clearAllMocks()
  })

  const createTestNode = (id: number = 1): LGraphNode => {
    const node = new LGraphNode('test')
    node.id = id
    node.mode = LGraphEventMode.ALWAYS
    return node
  }

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

  test('should render bypass button', () => {
    const canvasStore = useCanvasStore()
    const testNode = createTestNode()

    canvasStore.selectedItems = [testNode]
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })

  test('should have correct test id', () => {
    const canvasStore = useCanvasStore()
    const testNode = createTestNode()

    canvasStore.selectedItems = [testNode]
    const wrapper = mountComponent()
    const button = wrapper.find('[data-testid="bypass-button"]')
    expect(button.exists()).toBe(true)
  })

  test('should execute bypass command when clicked', async () => {
    const canvasStore = useCanvasStore()
    const commandStore = useCommandStore()
    const testNode = createTestNode()

    canvasStore.selectedItems = [testNode]
    const executeSpy = vi.spyOn(commandStore, 'execute').mockResolvedValue()

    const wrapper = mountComponent()
    await wrapper.find('button').trigger('click')

    expect(executeSpy).toHaveBeenCalledWith(
      'Comfy.Canvas.ToggleSelectedNodes.Bypass'
    )
  })

  test('should handle multiple selected items', () => {
    const canvasStore = useCanvasStore()
    const commandStore = useCommandStore()

    vi.spyOn(commandStore, 'execute').mockResolvedValue()
    canvasStore.selectedItems = [createTestNode(1), createTestNode(2)]
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })
})
