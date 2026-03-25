import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import UrlInput from './UrlInput.vue'
import type { ComponentProps } from 'vue-component-type-helpers'

describe('UrlInput', () => {
  function renderComponent(
    props: ComponentProps<typeof UrlInput> & {
      placeholder?: string
      disabled?: boolean
      'onUpdate:modelValue'?: (value: string) => void
    }
  ) {
    const user = userEvent.setup()

    const result = render(UrlInput, {
      global: {
        plugins: [PrimeVue],
        components: { IconField, InputIcon, InputText }
      },
      props
    })

    return { ...result, user }
  }

  it('passes through additional attributes to input element', () => {
    renderComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      disabled: true
    })

    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('emits update:modelValue on blur', async () => {
    const onUpdate = vi.fn()
    const { user } = renderComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      'onUpdate:modelValue': onUpdate
    })

    const input = screen.getByRole('textbox')
    await user.type(input, 'https://test.com/')
    await user.tab()

    expect(onUpdate).toHaveBeenCalledWith('https://test.com/')
  })

  it('renders spinner when validation is loading', async () => {
    const { container, rerender } = renderComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      validateUrlFn: () =>
        new Promise(() => {
          // Never resolves, simulating perpetual loading state
        })
    })

    await rerender({ modelValue: 'https://test.com' })
    await nextTick()
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue InputIcon uses pi-spinner class with no ARIA role
    expect(container.querySelector('.pi-spinner')).not.toBeNull()
  })

  it('renders check icon when validation is valid', async () => {
    const { container, rerender } = renderComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      validateUrlFn: () => Promise.resolve(true)
    })

    await rerender({ modelValue: 'https://test.com' })
    await nextTick()
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue InputIcon uses pi-check class with no ARIA role
    expect(container.querySelector('.pi-check')).not.toBeNull()
  })

  it('renders cross icon when validation is invalid', async () => {
    const { container, rerender } = renderComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      validateUrlFn: () => Promise.resolve(false)
    })

    await rerender({ modelValue: 'https://test.com' })
    await nextTick()
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue InputIcon uses pi-times class with no ARIA role
    expect(container.querySelector('.pi-times')).not.toBeNull()
  })

  it('validates on mount', async () => {
    const { container } = renderComponent({
      modelValue: 'https://test.com',
      validateUrlFn: () => Promise.resolve(true)
    })

    await nextTick()
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue InputIcon uses pi-check class with no ARIA role
    expect(container.querySelector('.pi-check')).not.toBeNull()
  })

  it('triggers validation when clicking the validation icon', async () => {
    let validationCount = 0
    const { container, user } = renderComponent({
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
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue InputIcon uses pi-check class with no ARIA role
    const icon = container.querySelector('.pi-check')!
    await user.click(icon)
    await nextTick()
    await nextTick()

    expect(validationCount).toBe(2) // Once on mount, once on click
  })

  it('prevents multiple simultaneous validations', async () => {
    let validationCount = 0
    const { container, rerender, user } = renderComponent({
      modelValue: '',
      validateUrlFn: () => {
        validationCount++
        return new Promise(() => {
          // Never resolves, simulating perpetual loading state
        })
      }
    })

    await rerender({ modelValue: 'https://test.com' })
    await nextTick()
    await nextTick()

    // Trigger multiple validations in quick succession
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue InputIcon
    const spinner = container.querySelector('.pi-spinner')!
    await user.click(spinner)
    await user.click(spinner)
    await user.click(spinner)

    await nextTick()
    await nextTick()

    expect(validationCount).toBe(1) // Only the initial validation should occur
  })

  describe('input cleaning functionality', () => {
    it('trims whitespace when user types', async () => {
      renderComponent({
        modelValue: '',
        placeholder: 'Enter URL'
      })

      const input = screen.getByRole('textbox')

      // The component strips whitespace on input via handleInput
      // We use fireEvent.input to simulate the input event handler directly
      await fireEvent.update(input, '  https://leading-space.com')
      await nextTick()
      expect(input).toHaveValue('https://leading-space.com')

      await fireEvent.update(input, 'https://trailing-space.com  ')
      await nextTick()
      expect(input).toHaveValue('https://trailing-space.com')

      await fireEvent.update(input, '  https://both-spaces.com  ')
      await nextTick()
      expect(input).toHaveValue('https://both-spaces.com')

      await fireEvent.update(input, 'https:// middle-space.com')
      await nextTick()
      expect(input).toHaveValue('https://middle-space.com')
    })

    it('trims whitespace when value set externally', async () => {
      const { rerender } = renderComponent({
        modelValue: '  https://initial-value.com  ',
        placeholder: 'Enter URL'
      })

      const input = screen.getByRole('textbox')

      // Check initial value is trimmed
      expect(input).toHaveValue('https://initial-value.com')

      // Update props with whitespace
      await rerender({ modelValue: '  https://updated-value.com  ' })
      await nextTick()

      // Check updated value is trimmed
      expect(input).toHaveValue('https://updated-value.com')
    })
  })
})
