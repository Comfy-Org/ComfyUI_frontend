import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import PopupSlider from '@/components/load3d/controls/PopupSlider.vue'

vi.mock('primevue/slider', () => ({
  default: {
    name: 'Slider',
    props: ['modelValue', 'min', 'max', 'step'],
    emits: ['update:modelValue'],
    template: `
      <input
        type="range"
        role="slider"
        :value="modelValue"
        :min="min"
        :max="max"
        :step="step"
        @input="$emit('update:modelValue', Number($event.target.value))"
      />
    `
  }
}))

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
  const utils = render(PopupSlider, {
    props: {
      tooltipText: props.tooltipText ?? 'FOV',
      icon: props.icon,
      min: props.min,
      max: props.max,
      step: props.step,
      modelValue: value.value,
      'onUpdate:modelValue': (v: number | undefined) => {
        if (v !== undefined) value.value = v
      }
    },
    global: {
      directives: { tooltip: () => {} }
    }
  })
  return { ...utils, value, user: userEvent.setup() }
}

describe('PopupSlider', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

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
    const slider = screen.getByRole('slider') as HTMLInputElement

    expect(slider.min).toBe('10')
    expect(slider.max).toBe('150')
    expect(slider.step).toBe('1')
  })

  it('uses caller-provided min / max / step over the defaults', async () => {
    const { user } = renderComponent({
      tooltipText: 'Light',
      min: 0,
      max: 5,
      step: 0.25
    })
    await user.click(screen.getByRole('button', { name: 'Light' }))
    const slider = screen.getByRole('slider') as HTMLInputElement

    expect(slider.min).toBe('0')
    expect(slider.max).toBe('5')
    expect(slider.step).toBe('0.25')
  })

  it('updates the v-model when the slider value changes', async () => {
    const { user, value } = renderComponent({
      tooltipText: 'FOV',
      initial: 50
    })
    await user.click(screen.getByRole('button', { name: 'FOV' }))
    const slider = screen.getByRole('slider') as HTMLInputElement

    slider.value = '120'
    slider.dispatchEvent(new Event('input', { bubbles: true }))

    expect(value.value).toBe(120)
  })
})
