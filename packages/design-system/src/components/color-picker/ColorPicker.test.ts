import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import ColorPicker from './ColorPicker.vue'

describe('ColorPicker', () => {
  it('labels the trigger and panel controls with caller text', async () => {
    const user = userEvent.setup()
    const { rerender } = render(ColorPicker, {
      props: {
        modelValue: '#ff0000',
        accessibleLabel: 'Light color',
        hexLabel: 'Hexadecimal value',
        rgbaLabel: 'Channel values',
        hueLabel: 'Hue angle',
        alphaLabel: 'Opacity level',
        redLabel: 'Crimson channel',
        greenLabel: 'Emerald channel',
        blueLabel: 'Azure channel',
        saturationBrightnessLabel: 'Color intensity and luminance',
        formatLabel: 'Value representation'
      }
    })

    expect(
      screen.getByRole('button', { name: 'Light color' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Light color' }))
    expect(
      screen.getByRole('slider', { name: 'Hue angle' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('slider', { name: 'Opacity level' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('slider', { name: 'Color intensity and luminance' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Hexadecimal value' })
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('combobox', { name: 'Value representation' })
    )
    await user.click(
      await screen.findByRole('option', { name: 'Channel values' })
    )
    expect(
      screen.getByRole('spinbutton', { name: 'Crimson channel' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('spinbutton', { name: 'Emerald channel' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('spinbutton', { name: 'Azure channel' })
    ).toBeInTheDocument()

    await rerender({
      hueLabel: 'Updated hue',
      alphaLabel: 'Updated opacity',
      saturationBrightnessLabel: 'Updated intensity'
    })
    expect(screen.getByRole('slider', { name: 'Updated hue' })).toBeVisible()
    expect(
      screen.getByRole('slider', { name: 'Updated opacity' })
    ).toBeVisible()
    expect(
      screen.getByRole('slider', { name: 'Updated intensity' })
    ).toBeVisible()
  })
  it('names the default trigger after the value it displays', async () => {
    const user = userEvent.setup()
    render(ColorPicker, {
      props: {
        modelValue: '#ff000080',
        hexLabel: 'Hex',
        rgbaLabel: 'RGBA',
        hueLabel: 'Hue',
        alphaLabel: 'Alpha',
        redLabel: 'Red',
        greenLabel: 'Green',
        blueLabel: 'Blue',
        saturationBrightnessLabel: 'Saturation and brightness',
        formatLabel: 'Format'
      }
    })

    await user.click(screen.getByRole('button', { name: '#ff0000 50%' }))
    await user.click(screen.getByRole('combobox', { name: 'Format' }))
    await user.click(await screen.findByRole('option', { name: 'RGBA' }))

    expect(
      screen.getByRole('button', { name: '255 0 0 50%' })
    ).toBeInTheDocument()
  })
})
