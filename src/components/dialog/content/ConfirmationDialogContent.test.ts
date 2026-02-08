import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ConfirmationDialogContent from './ConfirmationDialogContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

describe('ConfirmationDialogContent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function mountComponent(props = {}) {
    return mount(ConfirmationDialogContent, {
      global: {
        plugins: [PrimeVue, i18n]
      },
      props: {
        message: 'Test message',
        type: 'default' as const,
        onConfirm: vi.fn(),
        ...props
      }
    })
  }

  it('renders long messages without breaking layout', () => {
    const longFilename =
      'workflow_checkpoint_' + 'a'.repeat(200) + '.safetensors'
    const wrapper = mountComponent({ message: longFilename })
    expect(wrapper.text()).toContain(longFilename)
  })

  it('uses flex-wrap on button container for narrow viewports', () => {
    const wrapper = mountComponent()
    const buttonRow = wrapper.find('.flex.flex-wrap.justify-end.gap-4')
    expect(buttonRow.exists()).toBe(true)
  })
})
