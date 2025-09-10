import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'

const commandStore = {
  execute: vi.fn()
}
const selectionState = {
  hasAnySelection: ref(true)
}
vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn(() => commandStore)
}))

vi.mock('@/composables/graph/useSelectionState', () => ({
  useSelectionState: vi.fn(() => selectionState)
}))

describe('BypassButton', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        selectionToolbox: {
          bypassButton: {
            tooltip: 'Fake Bypass text'
          }
        },
        'commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label':
          'Fake Toggle Bypass'
      }
    }
  })

  beforeEach(() => {
    vi.resetAllMocks()
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

  test('should render bypass button when items are selected', () => {
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })

  test('should have correct test id', () => {
    const wrapper = mountComponent()
    const button = wrapper.find('[data-testid="bypass-button"]')
    expect(button.exists()).toBe(true)
  })

  test('should execute bypass command when clicked', async () => {
    const wrapper = mountComponent()
    await wrapper.find('button').trigger('click')
    expect(commandStore.execute).toHaveBeenCalledWith(
      'Comfy.Canvas.ToggleSelectedNodes.Bypass'
    )
  })

  test('should show button when hasAnySelection is true', () => {
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.element.style.display).toBe('')
  })

  test('Button should not show when hasAnySelection is false', async () => {
    selectionState.hasAnySelection = computed(() => false)
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()
    const button = wrapper.find('button')
    expect(button.element.style.display).toBe('none')
  })
})
