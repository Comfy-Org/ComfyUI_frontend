import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import PopupSlider from '@/components/load3d/controls/PopupSlider.vue'

function renderComponent(
  props: {
    tooltipText?: string
    icon?: string
    min?: number
    max?: number
    step?: number
    initial?: number
  } = {}
) {
  const value = ref<number>(props.initial ?? 50)
  const utils = render(
    defineComponent({
      setup: () => () =>
        h(PopupSlider, {
          tooltipText: props.tooltipText ?? 'FOV',
          icon: props.icon,
          min: props.min,
          max: props.max,
          step: props.step,
          modelValue: value.value,
          'onUpdate:modelValue': (v: number | undefined) => {
            if (v !== undefined) value.value = v
          }
        })
    }),
    {
      global: {
        directives: { tooltip: () => {} }
      }
    }
  )
  return { ...utils, value, user: userEvent.setup() }
}

describe('PopupSlider', () => {
  it('keeps the slider hidden from the accessibility tree until the trigger is clicked', () => {
    renderComponent({ tooltipText: 'FOV' })

    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('reveals the slider when the trigger is clicked and hides it again on a second click', async () => {
    const { user } = renderComponent({ tooltipText: 'FOV' })

    await user.click(screen.getByRole('button', { name: 'FOV' }))
    expect(screen.getByRole('slider')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'FOV' }))
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('hides the slider when the user clicks outside the popup', async () => {
    const { user } = renderComponent({ tooltipText: 'FOV' })

    await user.click(screen.getByRole('button', { name: 'FOV' }))
    expect(screen.getByRole('slider')).toBeVisible()

    await user.click(document.body)
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('forwards default min / max / step (10 / 150 / 1) when none are provided', async () => {
    const { user } = renderComponent({ tooltipText: 'FOV' })
    await user.click(screen.getByRole('button', { name: 'FOV' }))
    const slider = await screen.findByRole('slider')

    expect(slider).toHaveAttribute('aria-valuemin', '10')
    expect(slider).toHaveAttribute('aria-valuemax', '150')
    slider.focus()
    await user.keyboard('{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuenow', '51')
  })

  it('uses caller-provided min / max / step over the defaults', async () => {
    const { user } = renderComponent({
      tooltipText: 'Light',
      min: 0,
      max: 5,
      step: 0.25
    })
    await user.click(screen.getByRole('button', { name: 'Light' }))
    const slider = await screen.findByRole('slider')

    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '5')
    slider.focus()
    await user.keyboard('{Home}{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuenow', '0.25')
  })

  it('updates the v-model when the slider value changes', async () => {
    const { user, value } = renderComponent({
      tooltipText: 'FOV',
      initial: 50
    })
    await user.click(screen.getByRole('button', { name: 'FOV' }))
    const slider = await screen.findByRole('slider')
    slider.focus()
    await user.keyboard('{ArrowRight>70}')

    expect(value.value).toBe(120)
  })
})
