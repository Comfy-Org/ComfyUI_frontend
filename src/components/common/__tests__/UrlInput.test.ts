import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from 'vue'

import UrlInput from '../UrlInput.vue'

describe('UrlInput', () => {
  beforeEach(() => {
    const app = createApp({})
    app.use(PrimeVue)
  })

  it('passes through additional attributes to input element', () => {
    const wrapper = mount(UrlInput, {
      global: {
        plugins: [PrimeVue],
        components: { IconField, InputIcon, InputText }
      },
      props: {
        modelValue: '',
        placeholder: 'Enter URL',
        disabled: true
      }
    })

    expect(wrapper.find('input').attributes('disabled')).toBe('')
  })
})
