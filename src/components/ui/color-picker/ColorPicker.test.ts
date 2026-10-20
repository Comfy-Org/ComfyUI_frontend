import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import ColorPicker from './ColorPicker.vue'

describe('ColorPicker', () => {
  it('labels the trigger and panel controls with caller text', async () => {
    const user = userEvent.setup()
    render(ColorPicker, {
      props: {
        modelValue: '#ff0000',
        accessibleLabel: 'Light color',
        hexLabel: 'Hex',
        rgbaLabel: 'RGBA',
        hueLabel: 'Hue',
        alphaLabel: 'Alpha',
        redLabel: 'Red',
        greenLabel: 'Green',
        blueLabel: 'Blue',
        saturationBrightnessLabel: 'Saturation and brightness',
        formatLabel: 'Color format'
      }
    })

    expect(
      screen.getByRole('button', { name: 'Light color' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Light color' }))
    expect(screen.getByRole('slider', { name: 'Hue' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Alpha' })).toBeInTheDocument()
    expect(
      screen.getByRole('slider', { name: 'Saturation and brightness' })
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Hex' })).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Color format' }))
    await user.click(await screen.findByRole('option', { name: 'RGBA' }))
    expect(screen.getByRole('spinbutton', { name: 'Red' })).toBeInTheDocument()
    expect(
      screen.getByRole('spinbutton', { name: 'Green' })
    ).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Blue' })).toBeInTheDocument()
  })
})
