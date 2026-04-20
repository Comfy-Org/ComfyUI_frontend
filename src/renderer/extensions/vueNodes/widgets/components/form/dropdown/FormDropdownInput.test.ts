import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FormDropdownInput from './FormDropdownInput.vue'

const baseProps = {
  items: [],
  selected: new Set<string>(),
  maxSelectable: 1,
  uploadable: true,
  disabled: false
}

describe('FormDropdownInput', () => {
  it('marks the upload label as busy and disables the file input while loading', () => {
    const wrapper = mount(FormDropdownInput, {
      props: { ...baseProps, loading: true }
    })

    expect(wrapper.get('label').attributes('aria-busy')).toBe('true')
    expect(
      (wrapper.get('input[type="file"]').element as HTMLInputElement).disabled
    ).toBe(true)
  })

  it('is not busy and leaves the file input enabled when idle', () => {
    const wrapper = mount(FormDropdownInput, {
      props: { ...baseProps, loading: false }
    })

    expect(wrapper.get('label').attributes('aria-busy')).toBeUndefined()
    expect(
      (wrapper.get('input[type="file"]').element as HTMLInputElement).disabled
    ).toBe(false)
  })

  it('keeps the file input disabled when the whole widget is disabled, regardless of loading', () => {
    const wrapper = mount(FormDropdownInput, {
      props: { ...baseProps, disabled: true, loading: false }
    })

    expect(
      (wrapper.get('input[type="file"]').element as HTMLInputElement).disabled
    ).toBe(true)
  })
})
