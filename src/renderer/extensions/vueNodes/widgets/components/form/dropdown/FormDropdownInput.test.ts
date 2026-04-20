import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import FormDropdownInput from './FormDropdownInput.vue'

const baseProps = {
  items: [],
  selected: new Set<string>(),
  maxSelectable: 1,
  uploadable: true,
  disabled: false
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { loading: 'Loading' } } }
})

const mountInput = (props: object) =>
  mount(FormDropdownInput, {
    props,
    global: { plugins: [i18n] }
  })

const triggerButton = (wrapper: ReturnType<typeof mountInput>) =>
  wrapper.get('button').element as HTMLButtonElement

const fileInput = (wrapper: ReturnType<typeof mountInput>) =>
  wrapper.get('input[type="file"]').element as HTMLInputElement

describe('FormDropdownInput', () => {
  it('disables both the dropdown trigger and the file input while loading', () => {
    const wrapper = mountInput({ ...baseProps, loading: true })

    expect(triggerButton(wrapper).disabled).toBe(true)
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('label').attributes('aria-busy')).toBe('true')
    expect(fileInput(wrapper).disabled).toBe(true)
  })

  it('replaces the dropdown text with Loading… while loading', () => {
    const wrapper = mountInput({
      ...baseProps,
      loading: true,
      placeholder: 'Pick a file'
    })

    expect(wrapper.get('button').text()).toContain('Loading')
    expect(wrapper.get('button').text()).not.toContain('Pick a file')
  })

  it('shows the placeholder and leaves trigger + file input enabled when idle', () => {
    const wrapper = mountInput({
      ...baseProps,
      loading: false,
      placeholder: 'Pick a file'
    })

    expect(triggerButton(wrapper).disabled).toBe(false)
    expect(wrapper.get('button').attributes('aria-busy')).toBeUndefined()
    expect(wrapper.get('label').attributes('aria-busy')).toBeUndefined()
    expect(fileInput(wrapper).disabled).toBe(false)
    expect(wrapper.get('button').text()).toContain('Pick a file')
    expect(wrapper.get('button').text()).not.toContain('Loading')
  })

  it('keeps the file input disabled when the whole widget is disabled, regardless of loading', () => {
    const wrapper = mountInput({
      ...baseProps,
      disabled: true,
      loading: false
    })

    expect(fileInput(wrapper).disabled).toBe(true)
  })
})
