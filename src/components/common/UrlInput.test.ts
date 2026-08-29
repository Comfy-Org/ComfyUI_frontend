import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import UrlInput from './UrlInput.vue'
import type { ComponentProps } from 'vue-component-type-helpers'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

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
      global: { plugins: [i18n] },
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

    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('emits update:modelValue on blur', async () => {
    const onUpdate = vi.fn()
    const { user } = renderComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      'onUpdate:modelValue': onUpdate
    })

    const input = screen.getByRole('combobox')
    await user.type(input, 'https://test.com/')
    expect(onUpdate).not.toHaveBeenCalled()

    await user.tab()

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith('https://test.com/')
  })

  it('renders spinner when validation is loading', async () => {
    const { rerender } = renderComponent({
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

    expect(
      screen.getByRole('button', { name: enMessages.g.validate })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: enMessages.g.validate })
    ).toHaveAttribute('data-validation-state', 'LOADING')
  })

  it('renders check icon when validation is valid', async () => {
    const { rerender } = renderComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      validateUrlFn: () => Promise.resolve(true)
    })

    await rerender({ modelValue: 'https://test.com' })
    await nextTick()
    await nextTick()

    expect(
      screen.getByRole('button', { name: enMessages.g.validate })
    ).toHaveAttribute('data-validation-state', 'VALID')
  })

  it('renders cross icon when validation is invalid', async () => {
    const { rerender } = renderComponent({
      modelValue: '',
      placeholder: 'Enter URL',
      validateUrlFn: () => Promise.resolve(false)
    })

    await rerender({ modelValue: 'https://test.com' })
    await nextTick()
    await nextTick()

    expect(
      screen.getByRole('button', { name: enMessages.g.validate })
    ).toHaveAttribute('data-validation-state', 'INVALID')
  })

  it('validates on mount', async () => {
    renderComponent({
      modelValue: 'https://test.com',
      validateUrlFn: () => Promise.resolve(true)
    })

    await nextTick()
    await nextTick()

    expect(
      screen.getByRole('button', { name: enMessages.g.validate })
    ).toHaveAttribute('data-validation-state', 'VALID')
  })

  it('triggers validation when clicking the validation icon', async () => {
    let validationCount = 0
    const { user } = renderComponent({
      modelValue: 'https://test.com',
      validateUrlFn: () => {
        validationCount++
        return Promise.resolve(true)
      }
    })

    // Wait for initial validation
    await nextTick()
    await nextTick()

    await user.click(
      screen.getByRole('button', { name: enMessages.g.validate })
    )
    await nextTick()
    await nextTick()

    expect(validationCount).toBe(2) // Once on mount, once on click
  })

  it('prevents multiple simultaneous validations', async () => {
    let validationCount = 0
    const { rerender, user } = renderComponent({
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

    const validationButton = screen.getByRole('button', {
      name: enMessages.g.validate
    })
    await user.click(validationButton)
    await user.click(validationButton)
    await user.click(validationButton)

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

      const input = screen.getByRole('combobox')

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

      const input = screen.getByRole('combobox')

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
