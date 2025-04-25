import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from 'vue'

import EditableText from './EditableText.vue'

describe('EditableText', () => {
  beforeAll(() => {
    // Create a Vue app instance for PrimeVue
    const app = createApp({})
    app.use(PrimeVue)
  })

  // @ts-expect-error fixme ts strict error
  const mountComponent = (props, options = {}) => {
    return mount(EditableText, {
      global: {
        plugins: [PrimeVue],
        components: { InputText }
      },
      props,
      ...options
    })
  }

  it('renders span with modelValue when not editing', () => {
    const wrapper = mountComponent({
      modelValue: 'Test Text',
      isEditing: false
    })
    expect(wrapper.find('span').text()).toBe('Test Text')
    expect(wrapper.findComponent(InputText).exists()).toBe(false)
  })

  it('renders input with modelValue when editing', () => {
    const wrapper = mountComponent({
      modelValue: 'Test Text',
      isEditing: true
    })
    expect(wrapper.find('span').exists()).toBe(false)
    expect(wrapper.findComponent(InputText).props()['modelValue']).toBe(
      'Test Text'
    )
  })

  it('emits edit event when input is submitted', async () => {
    const wrapper = mountComponent({
      modelValue: 'Test Text',
      isEditing: true
    })
    await wrapper.findComponent(InputText).setValue('New Text')
    await wrapper.findComponent(InputText).trigger('keyup.enter')
    // Blur event should have been triggered
    expect(wrapper.findComponent(InputText).element).not.toBe(
      document.activeElement
    )
  })

  it('finishes editing on blur', async () => {
    const wrapper = mountComponent({
      modelValue: 'Test Text',
      isEditing: true
    })
    await wrapper.findComponent(InputText).trigger('blur')
    expect(wrapper.emitted('edit')).toBeTruthy()
    // @ts-expect-error fixme ts strict error
    expect(wrapper.emitted('edit')[0]).toEqual(['Test Text'])
  })
})
