import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'

import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'
import { registerTestWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderComponent(
  value: number,
  options: IWidgetOptions = {},
  name = 'test_slider'
) {
  const widgetId = registerTestWidget({
    value,
    name,
    type: 'float',
    options: { min: 0, max: 100, step: 1, precision: 0, ...options }
  })
  return render(WidgetInputNumberSlider, {
    global: { plugins: [i18n] },
    props: { widgetId, modelValue: value }
  })
}

describe('WidgetInputNumberSlider', () => {
  it.for([5, 42])(
    'renders %s in the slider and number input',
    async (value) => {
      renderComponent(value)

      expect(await screen.findByRole('slider')).toHaveAttribute(
        'aria-valuenow',
        String(value)
      )
      expect(screen.getByRole('spinbutton')).toHaveValue(String(value))
    }
  )

  it('keeps separate instances bound to their own values', async () => {
    renderComponent(5, {}, 'first_slider')
    renderComponent(10, {}, 'second_slider')

    expect(
      (await screen.findAllByRole('slider')).map((slider) =>
        slider.getAttribute('aria-valuenow')
      )
    ).toEqual(['5', '10'])
  })

  it.for([
    { min: -10, max: 50 },
    { min: -100, max: 100 }
  ])('applies the range $min to $max', async (options) => {
    renderComponent(0, options)
    const slider = await screen.findByRole('slider')

    expect(slider).toHaveAttribute('aria-valuemin', String(options.min))
    expect(slider).toHaveAttribute('aria-valuemax', String(options.max))
  })

  it.for<{
    name: string
    options: IWidgetOptions
    expected: number
  }>([
    { name: 'default', options: {}, expected: 6 },
    { name: 'step2', options: { step2: 0.01 }, expected: 5.01 },
    { name: 'precision 0', options: { precision: 0 }, expected: 6 },
    { name: 'precision 1', options: { precision: 1 }, expected: 5.1 },
    { name: 'precision 5', options: { precision: 5 }, expected: 5.00001 }
  ])('increments using $name', async ({ options, expected }) => {
    const user = userEvent.setup()
    const { emitted } = renderComponent(5, options)
    const slider = await screen.findByRole('slider')

    slider.focus()
    await user.keyboard('{ArrowRight}')

    expect(emitted('update:modelValue')).toEqual([[expected]])
  })

  it('commits a typed number input on Enter', async () => {
    const user = userEvent.setup()
    const { emitted } = renderComponent(5)

    await user.tripleClick(screen.getByRole('spinbutton'))
    await user.keyboard('7{Enter}')

    expect(emitted('update:modelValue')).toEqual([[7]])
  })
})
