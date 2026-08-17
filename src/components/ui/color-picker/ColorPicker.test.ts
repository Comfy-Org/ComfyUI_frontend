import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import ColorPicker from './ColorPicker.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      color: {
        alpha: 'Alpha',
        hex: 'Hex',
        hue: 'Hue',
        rgba: 'RGBA',
        saturationBrightness: 'Color saturation and brightness'
      }
    }
  }
})

describe('ColorPicker', () => {
  it('closes an open popover when disabled', async () => {
    const user = userEvent.setup()
    const { rerender } = render(ColorPicker, {
      global: { plugins: [i18n] },
      props: { modelValue: '#112233' }
    })
    const trigger = screen.getByRole('button')

    await user.click(trigger)
    expect(
      await screen.findByRole('textbox', { name: 'Hex' })
    ).toBeInTheDocument()

    await rerender({ disabled: true, modelValue: '#112233' })

    await waitFor(() => {
      expect(
        screen.queryByRole('textbox', { name: 'Hex' })
      ).not.toBeInTheDocument()
    })
    expect(trigger).toBeDisabled()
  })

  it('does not reopen from a custom trigger when disabled', async () => {
    const user = userEvent.setup()
    const { rerender } = render(ColorPicker, {
      global: { plugins: [i18n] },
      props: { modelValue: '#112233' },
      slots: {
        trigger: '<button type="button">Custom trigger</button>'
      }
    })
    const trigger = screen.getByRole('button', { name: 'Custom trigger' })

    await user.click(trigger)
    expect(
      await screen.findByRole('textbox', { name: 'Hex' })
    ).toBeInTheDocument()

    await rerender({ disabled: true, modelValue: '#112233' })
    await waitFor(() => {
      expect(
        screen.queryByRole('textbox', { name: 'Hex' })
      ).not.toBeInTheDocument()
    })

    await user.click(trigger)

    expect(
      screen.queryByRole('textbox', { name: 'Hex' })
    ).not.toBeInTheDocument()
  })
})
