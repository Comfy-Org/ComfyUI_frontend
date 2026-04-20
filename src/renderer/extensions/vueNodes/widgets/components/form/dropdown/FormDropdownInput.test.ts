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

type Root = Pick<Element, 'querySelector'>

const uploadLabel = (container: Root) =>
  container.querySelector<HTMLLabelElement>('label')

const fileInput = (container: Root) =>
  container.querySelector<HTMLInputElement>('input[type="file"]')

describe('FormDropdownInput', () => {
  it('marks the upload label as busy and disables the file input while loading', () => {
    const { container } = render(FormDropdownInput, {
      props: { ...baseProps, loading: true }
    })

    expect(uploadLabel(container)?.getAttribute('aria-busy')).toBe('true')
    expect(fileInput(container)?.disabled).toBe(true)
  })

  it('is not busy and leaves the file input enabled when idle', () => {
    const { container } = render(FormDropdownInput, {
      props: { ...baseProps, loading: false }
    })

    expect(uploadLabel(container)?.getAttribute('aria-busy')).toBeNull()
    expect(fileInput(container)?.disabled).toBe(false)
  })

  it('keeps the file input disabled when the whole widget is disabled, regardless of loading', () => {
    const { container } = render(FormDropdownInput, {
      props: { ...baseProps, disabled: true, loading: false }
    })

    expect(fileInput(container)?.disabled).toBe(true)
  })
})
