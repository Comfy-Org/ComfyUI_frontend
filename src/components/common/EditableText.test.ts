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
    expect(wrapper.emitted('edit')?.[0]).toEqual(['Test Text'])

    // Should exit edit mode via v-model
    expect(wrapper.emitted('update:isEditing')?.at(-1)).toEqual([false])
  })

  it('cancels editing on escape key', async () => {
    const wrapper = mountComponent({
      modelValue: 'Original Text',
      isEditing: true
    })

    // Change the input value
    await wrapper.findComponent(InputText).setValue('Modified Text')

    // Press escape
    await wrapper.findComponent(InputText).trigger('keyup.escape')

    // Should emit cancel event
    expect(wrapper.emitted('cancel')).toBeTruthy()

    // Should NOT emit edit event
    expect(wrapper.emitted('edit')).toBeFalsy()

    // Should exit edit mode (isEditing set to false via v-model)
    expect(wrapper.emitted('update:isEditing')).toBeTruthy()
    expect(wrapper.emitted('update:isEditing')?.at(-1)).toEqual([false])

    // Text should be reset to original value (now displayed in span)
    expect(wrapper.find('span').text()).toBe('Original Text')
  })

  it('does not save changes when escape is pressed and blur occurs', async () => {
    const wrapper = mountComponent({
      modelValue: 'Original Text',
      isEditing: true
    })

    // Change the input value
    await wrapper.findComponent(InputText).setValue('Modified Text')

    // Press escape (which triggers blur internally and sets isEditing to false)
    await wrapper.findComponent(InputText).trigger('keyup.escape')

    // Should emit cancel but not edit
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('edit')).toBeFalsy()

    // Should exit edit mode
    expect(wrapper.emitted('update:isEditing')?.at(-1)).toEqual([false])
  })

  it('saves changes on enter but not on escape', async () => {
    // Test Enter key saves changes
    const enterWrapper = mountComponent({
      modelValue: 'Original Text',
      isEditing: true
    })
    await enterWrapper.findComponent(InputText).setValue('Saved Text')
    await enterWrapper.findComponent(InputText).trigger('keyup.enter')
    // Trigger blur that happens after enter
    await enterWrapper.findComponent(InputText).trigger('blur')
    expect(enterWrapper.emitted('edit')).toBeTruthy()
    expect(enterWrapper.emitted('edit')?.[0]).toEqual(['Saved Text'])

    // Test Escape key cancels changes with a fresh wrapper
    const escapeWrapper = mountComponent({
      modelValue: 'Original Text',
      isEditing: true
    })
    await escapeWrapper.findComponent(InputText).setValue('Cancelled Text')
    await escapeWrapper.findComponent(InputText).trigger('keyup.escape')
    expect(escapeWrapper.emitted('cancel')).toBeTruthy()
    expect(escapeWrapper.emitted('edit')).toBeFalsy()
  })

  describe('doubleClickToEdit', () => {
    it('enters edit mode on double-click when doubleClickToEdit is true', async () => {
      const wrapper = mountComponent({
        modelValue: 'Test Text',
        isEditing: false,
        doubleClickToEdit: true
      })

      expect(wrapper.find('span').exists()).toBe(true)
      await wrapper.find('span').trigger('dblclick')

      expect(wrapper.emitted('update:isEditing')?.[0]).toEqual([true])
    })

    it('does not enter edit mode on double-click when doubleClickToEdit is false', async () => {
      const wrapper = mountComponent({
        modelValue: 'Test Text',
        isEditing: false,
        doubleClickToEdit: false
      })

      await wrapper.find('span').trigger('dblclick')

      expect(wrapper.emitted('update:isEditing')).toBeFalsy()
    })

    it('does not enter edit mode on double-click by default', async () => {
      const wrapper = mountComponent({
        modelValue: 'Test Text',
        isEditing: false
      })

      await wrapper.find('span').trigger('dblclick')

      expect(wrapper.emitted('update:isEditing')).toBeFalsy()
    })
  })
})
