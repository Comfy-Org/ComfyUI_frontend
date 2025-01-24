import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, nextTick } from 'vue'

import UrlInput from '../UrlInput.vue'

describe('UrlInput', () => {
  beforeEach(() => {
    const app = createApp({})
    app.use(PrimeVue)
  })

  const mountComponent = (props: any, options = {}) => {
    return mount(UrlInput, {
      global: {
        plugins: [PrimeVue],
        components: { IconField, InputIcon, InputText }
      },
      props,
      ...options
    })
  }

  it('passes through additional attributes to input element', () => {
    const wrapper = mountComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      disabled: true
    })

    expect(wrapper.find('input').attributes('disabled')).toBe('')
  })

  it('emits update:modelValue on blur', async () => {
    const wrapper = mountComponent({
      modelValue: '',
      placeholder: 'Enter URL'
    })

    const input = wrapper.find('input')
    await input.setValue('https://test.com')
    await input.trigger('blur')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      'https://test.com'
    ])
  })

  it('renders spinner when validation is loading', async () => {
    const wrapper = mountComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      validateUrlFn: () =>
        new Promise(() => {
          // Never resolves, simulating perpetual loading state
        })
    })

    wrapper.setProps({ modelValue: 'https://test.com' })
    await nextTick()
    await nextTick()

    expect(wrapper.find('.pi-spinner').exists()).toBe(true)
  })

  it('renders check icon when validation is valid', async () => {
    const wrapper = mountComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      validateUrlFn: () => Promise.resolve(true)
    })

    wrapper.setProps({ modelValue: 'https://test.com' })
    await nextTick()
    await nextTick()

    expect(wrapper.find('.pi-check').exists()).toBe(true)
  })

  it('renders cross icon when validation is invalid', async () => {
    const wrapper = mountComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      validateUrlFn: () => Promise.resolve(false)
    })

    wrapper.setProps({ modelValue: 'https://test.com' })
    await nextTick()
    await nextTick()

    expect(wrapper.find('.pi-times').exists()).toBe(true)
  })

  it('validates on mount', async () => {
    const wrapper = mountComponent({
      modelValue: 'https://test.com',
      validateUrlFn: () => Promise.resolve(true)
    })

    await nextTick()
    await nextTick()

    expect(wrapper.find('.pi-check').exists()).toBe(true)
  })

  it('triggers validation when clicking the validation icon', async () => {
    let validationCount = 0
    const wrapper = mountComponent({
      modelValue: 'https://test.com',
      validateUrlFn: () => {
        validationCount++
        return Promise.resolve(true)
      }
    })

    // Wait for initial validation
    await nextTick()
    await nextTick()

    // Click the validation icon
    await wrapper.find('.pi-check').trigger('click')
    await nextTick()
    await nextTick()

    expect(validationCount).toBe(2) // Once on mount, once on click
  })

  it('prevents multiple simultaneous validations', async () => {
    let validationCount = 0
    const wrapper = mountComponent({
      modelValue: '',
      validateUrlFn: () => {
        validationCount++
        return new Promise(() => {
          // Never resolves, simulating perpetual loading state
        })
      }
    })

    wrapper.setProps({ modelValue: 'https://test.com' })
    await nextTick()
    await nextTick()

    // Trigger multiple validations in quick succession
    wrapper.find('.pi-spinner').trigger('click')
    wrapper.find('.pi-spinner').trigger('click')
    wrapper.find('.pi-spinner').trigger('click')

    await nextTick()
    await nextTick()

    expect(validationCount).toBe(1) // Only the initial validation should occur
  })
})
