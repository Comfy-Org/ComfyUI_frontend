import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ColorPickerPanel from '@/components/ui/color-picker/ColorPickerPanel.vue'
import type { HSVA } from '@/utils/colorUtil'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      color: {
        hex: 'Hex',
        rgba: 'RGBA',
        hue: 'Hue',
        alpha: 'Alpha',
        red: 'Red',
        green: 'Green',
        blue: 'Blue',
        saturationBrightness: 'Saturation and brightness'
      }
    }
  }
})

function renderPanel(initial: HSVA, mode: 'hex' | 'rgba' = 'hex') {
  const hsva = ref<HSVA>(initial)
  const displayMode = ref<'hex' | 'rgba'>(mode)

  const Host = defineComponent(
    () => () =>
      h(ColorPickerPanel, {
        hsva: hsva.value,
        'onUpdate:hsva': (value: HSVA) => {
          hsva.value = value
        },
        displayMode: displayMode.value,
        'onUpdate:displayMode': (value: 'hex' | 'rgba') => {
          displayMode.value = value
        },
        alpha: true
      })
  )

  render(Host, { global: { plugins: [i18n] } })

  return { hsva, user: userEvent.setup() }
}

const black: HSVA = { h: 0, s: 0, v: 0, a: 100 }

describe('ColorPickerPanel hex input', () => {
  it('updates the hsva model when a valid 6-digit hex is typed', async () => {
    const { hsva, user } = renderPanel({ ...black })

    const input = screen.getByRole('textbox', { name: 'Hex' })
    await user.clear(input)
    await user.type(input, 'ff0000')

    expect(hsva.value).toMatchObject({ h: 0, s: 100, v: 100 })
  })

  it('accepts 3-digit shorthand hex', async () => {
    const { hsva, user } = renderPanel({ ...black })

    const input = screen.getByRole('textbox', { name: 'Hex' })
    await user.clear(input)
    await user.type(input, '0f0')

    expect(hsva.value).toMatchObject({ h: 120, s: 100, v: 100 })
  })

  it('preserves the existing alpha when editing hex', async () => {
    const { hsva, user } = renderPanel({ h: 0, s: 0, v: 0, a: 40 })

    const input = screen.getByRole('textbox', { name: 'Hex' })
    await user.clear(input)
    await user.type(input, 'ffffff')

    expect(hsva.value.a).toBe(40)
  })

  it('ignores invalid input and leaves the model unchanged', async () => {
    const { hsva, user } = renderPanel({ ...black })

    const input = screen.getByRole('textbox', { name: 'Hex' })
    await user.clear(input)
    await user.type(input, 'nothex')

    expect(hsva.value).toEqual(black)
  })

  it('reformats the draft to canonical hex on blur', async () => {
    const { user } = renderPanel({ ...black })

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Hex' })
    await user.clear(input)
    await user.type(input, '0f0')
    await user.tab()

    expect(input.value).toBe('#00ff00')
  })
})

describe('ColorPickerPanel rgba inputs', () => {
  it('updates the hsva model when an RGB channel is edited', async () => {
    const { hsva, user } = renderPanel({ ...black }, 'rgba')

    const red = screen.getByRole('spinbutton', { name: 'Red' })
    await user.clear(red)
    await user.type(red, '255')

    expect(hsva.value).toMatchObject({ h: 0, s: 100, v: 100 })
  })

  it('clamps an out-of-range channel to 255 on blur', async () => {
    const { user } = renderPanel({ ...black }, 'rgba')

    const red = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Red'
    })
    await user.clear(red)
    await user.type(red, '300')
    await user.tab()

    expect(red.value).toBe('255')
  })

  it('edits alpha as a percentage', async () => {
    const { hsva, user } = renderPanel({ h: 0, s: 0, v: 0, a: 100 })

    const alpha = screen.getByRole('spinbutton', { name: 'Alpha' })
    await user.clear(alpha)
    await user.type(alpha, '50')

    expect(hsva.value.a).toBe(50)
  })
})
