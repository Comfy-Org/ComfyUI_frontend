import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import FormColorPicker from './FormColorPicker.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      color: {
        hex: 'Hex',
        rgba: 'RGBA',
        saturationBrightness: 'Color saturation and brightness',
        hue: 'Hue',
        alpha: 'Alpha'
      }
    }
  }
})

function renderForm(props: Record<string, unknown> = {}) {
  const user = userEvent.setup()
  const result = render(FormColorPicker, {
    global: { plugins: [i18n] },
    props: { modelValue: '000000', ...props }
  })
  return { ...result, user }
}

describe('FormColorPicker', () => {
  it('preserves the legacy no-# storage contract on commit', async () => {
    const onUpdate = vi.fn()
    const { user } = renderForm({
      modelValue: '000000',
      label: 'Color',
      'onUpdate:modelValue': onUpdate
    })
    const input = screen.getByPlaceholderText('Color') as HTMLInputElement

    await user.clear(input)
    await user.type(input, '#abcdef{enter}')

    expect(onUpdate).toHaveBeenLastCalledWith('abcdef')
  })

  it('does not commit incomplete hex while typing', async () => {
    const onUpdate = vi.fn()
    const { user } = renderForm({
      modelValue: '000000',
      label: 'Color',
      'onUpdate:modelValue': onUpdate
    })
    const input = screen.getByPlaceholderText('Color') as HTMLInputElement

    await user.clear(input)
    await user.type(input, '#ab')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('reverts to current value when partial entry is committed', async () => {
    const onUpdate = vi.fn()
    const { user } = renderForm({
      modelValue: '282828',
      label: 'Color',
      'onUpdate:modelValue': onUpdate
    })
    const input = screen.getByPlaceholderText('Color') as HTMLInputElement

    await user.clear(input)
    await user.type(input, '#ab{enter}')

    expect(onUpdate).not.toHaveBeenCalled()
    expect(input.value).toBe('282828')
  })

  it('accepts 8-digit hex (with alpha) on commit', async () => {
    const onUpdate = vi.fn()
    const { user } = renderForm({
      modelValue: '000000',
      label: 'Color',
      'onUpdate:modelValue': onUpdate
    })
    const input = screen.getByPlaceholderText('Color') as HTMLInputElement

    await user.clear(input)
    await user.type(input, '#11223344{enter}')

    expect(onUpdate).toHaveBeenLastCalledWith('11223344')
  })

  it('disables both inputs when disabled prop is set', () => {
    const { container } = renderForm({
      modelValue: '000000',
      label: 'Color',
      disabled: true
    })
    const textInput = screen.getByPlaceholderText('Color') as HTMLInputElement
    expect(textInput.disabled).toBe(true)

    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container -- the picker trigger has no stable accessible name
    const trigger = container.querySelector(
      '.color-picker-wrapper > button'
    ) as HTMLButtonElement | null
    expect(trigger).not.toBeNull()
    expect(trigger?.disabled).toBe(true)
  })
})
