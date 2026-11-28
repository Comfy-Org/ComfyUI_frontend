import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ColorPicker from './ColorPicker.vue'
import ColorPickerSaturationValue from './ColorPickerSaturationValue.vue'

const labels = {
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

describe('ColorPicker', () => {
  it('does not overwrite an externally supplied color after converting it to HSVA', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = render(ColorPicker, {
      props: {
        modelValue: '#000000',
        ...labels
      }
    })

    await rerender({ modelValue: '#f3ebdd' })

    expect(emitted('update:modelValue')).toBeUndefined()
    expect(screen.getByRole('button')).toHaveAccessibleName('#f3ebdd 100%')
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('textbox', { name: 'Hex' })).toHaveValue('#f3ebdd')
    await user.click(screen.getByRole('combobox', { name: 'Format' }))
    await user.click(await screen.findByRole('option', { name: 'RGBA' }))
    expect(screen.getByRole('spinbutton', { name: 'Red' })).toHaveValue(243)
    expect(screen.getByRole('spinbutton', { name: 'Green' })).toHaveValue(235)
    expect(screen.getByRole('spinbutton', { name: 'Blue' })).toHaveValue(221)
  })

  it('preserves a hashless externally supplied color', () => {
    render(ColorPicker, {
      props: {
        modelValue: 'ff0000',
        ...labels
      }
    })

    expect(screen.getByRole('button')).toHaveAccessibleName('#ff0000 100%')
  })

  it('publishes an explicit opacity edit that rounds to the displayed value', async () => {
    const user = userEvent.setup()
    const { emitted } = render(ColorPicker, {
      props: {
        modelValue: '#f3ebdd01',
        ...labels
      }
    })

    await user.click(screen.getByRole('button', { name: '#f3ebdd 0%' }))
    const alpha = screen.getByRole('spinbutton', { name: 'Alpha' })
    await user.clear(alpha)
    await user.type(alpha, '0')

    expect(emitted('update:modelValue')).toContainEqual(['#f3ebdd00'])
  })

  it('publishes one complete color for a saturation and brightness gesture', async () => {
    const user = userEvent.setup()
    const { emitted } = render(ColorPicker, {
      props: {
        modelValue: '#ff0000',
        ...labels
      }
    })

    await user.click(screen.getByRole('button', { name: '#ff0000 100%' }))
    const saturationBrightness = screen.getByRole('slider', {
      name: 'Saturation and brightness'
    })
    vi.spyOn(saturationBrightness, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 100, 100)
    )

    await user.pointer({
      keys: '[MouseLeft>]',
      target: saturationBrightness,
      coords: { clientX: 50, clientY: 50 }
    })

    expect(emitted('update:modelValue')).toEqual([['#7f3f3f']])
  })

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
        ...labels
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

describe('ColorPickerSaturationValue', () => {
  it('keeps the individual model updates alongside the atomic update', async () => {
    const user = userEvent.setup()
    const { emitted } = render(ColorPickerSaturationValue, {
      props: { hue: 0, saturation: 100, value: 100 }
    })
    const slider = screen.getByRole('slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 100, 100)
    )

    await user.pointer({
      keys: '[MouseLeft>]',
      target: slider,
      coords: { clientX: 50, clientY: 50 }
    })

    expect(emitted('update')).toEqual([[50, 50]])
    expect(emitted('update:saturation')).toEqual([[50]])
    expect(emitted('update:value')).toEqual([[50]])
  })
})
