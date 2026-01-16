import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import InfoButton from '@/components/graph/selectionToolbox/InfoButton.vue'

const openPanelMock = vi.fn()
vi.mock('@/stores/workspace/rightSidePanelStore', () => ({
  useRightSidePanelStore: () => ({
    openPanel: openPanelMock
  })
}))

describe('InfoButton', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          info: 'Node Info'
        }
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(InfoButton, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        stubs: {
          'i-lucide:info': true,
          Button: {
            template:
              '<button class="help-button" severity="secondary" @click="$emit(\'click\')"><slot /></button>',
            props: ['severity', 'text', 'class'],
            emits: ['click']
          }
        }
      }
    })
  }

  it('should open the info panel on click', async () => {
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    await button.trigger('click')
    expect(openPanelMock).toHaveBeenCalledWith('info')
  })

  it('should have correct CSS classes', () => {
    const wrapper = mountComponent()
    const button = wrapper.find('button')

    expect(button.classes()).toContain('help-button')
    expect(button.attributes('severity')).toBe('secondary')
  })
})
