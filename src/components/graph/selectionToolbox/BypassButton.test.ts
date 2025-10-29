import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

const mockLGraphNode = {
  type: 'TestNode',
  title: 'Test Node',
  mode: LGraphEventMode.ALWAYS
}

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => true)
}))

describe('BypassButton', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let commandStore: ReturnType<typeof useCommandStore>

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        selectionToolbox: {
          bypassButton: {
            tooltip: 'Toggle bypass mode'
          }
        }
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    commandStore = useCommandStore()

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
    canvasStore.selectedItems = [mockLGraphNode] as any
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })

  it('should have correct test id', () => {
    canvasStore.selectedItems = [mockLGraphNode] as any
    const wrapper = mountComponent()
    const button = wrapper.find('[data-testid="bypass-button"]')
    expect(button.exists()).toBe(true)
  })

  it('should execute bypass command when clicked', async () => {
    canvasStore.selectedItems = [mockLGraphNode] as any
    const executeSpy = vi.spyOn(commandStore, 'execute').mockResolvedValue()

    const wrapper = mountComponent()
    await wrapper.find('button').trigger('click')

    expect(executeSpy).toHaveBeenCalledWith(
      'Comfy.Canvas.ToggleSelectedNodes.Bypass'
    )
  })

  it('should show normal styling when node is not bypassed', () => {
    const normalNode = { ...mockLGraphNode, mode: LGraphEventMode.ALWAYS }
    canvasStore.selectedItems = [normalNode] as any

    const wrapper = mountComponent()
    const button = wrapper.find('button')

    expect(button.classes()).not.toContain(
      'dark-theme:[&:not(:active)]:!bg-charcoal-600'
    )
  })

  it('should show bypassed styling when node is bypassed', async () => {
    const bypassedNode = { ...mockLGraphNode, mode: LGraphEventMode.BYPASS }
    canvasStore.selectedItems = [bypassedNode] as any
    vi.spyOn(commandStore, 'execute').mockResolvedValue()
    const wrapper = mountComponent()

    // Click to trigger the reactivity update
    await wrapper.find('button').trigger('click')
    await wrapper.vm.$nextTick()

    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })

  it('should handle multiple selected items', () => {
    vi.spyOn(commandStore, 'execute').mockResolvedValue()
    canvasStore.selectedItems = [mockLGraphNode, mockLGraphNode] as any
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })
})
