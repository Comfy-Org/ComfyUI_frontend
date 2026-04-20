import { render } from '@testing-library/vue'
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
  it('renders the folder-search icon when not loading', () => {
    const { container } = render(FormDropdownInput, {
      props: { ...baseProps, loading: false }
    })

    expect(
      container.querySelector('.icon-\\[lucide--folder-search\\]')
    ).not.toBeNull()
    expect(
      container.querySelector('.icon-\\[lucide--loader-circle\\]')
    ).toBeNull()
  })

  it('renders the animated loader icon when loading', () => {
    const { container } = render(FormDropdownInput, {
      props: { ...baseProps, loading: true }
    })

    const loader = container.querySelector(
      '.icon-\\[lucide--loader-circle\\]'
    ) as HTMLElement | null
    expect(loader).not.toBeNull()
    expect(loader?.classList.contains('animate-spin')).toBe(true)
    expect(
      container.querySelector('.icon-\\[lucide--folder-search\\]')
    ).toBeNull()
  })

  it('disables the file input while loading', () => {
    const { container } = render(FormDropdownInput, {
      props: { ...baseProps, loading: true }
    })

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement | null
    expect(fileInput).not.toBeNull()
    expect(fileInput?.disabled).toBe(true)
  })

  it('leaves the file input enabled when not loading and not disabled', () => {
    const { container } = render(FormDropdownInput, {
      props: { ...baseProps, loading: false }
    })

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement | null
    expect(fileInput).not.toBeNull()
    expect(fileInput?.disabled).toBe(false)
  })
})
