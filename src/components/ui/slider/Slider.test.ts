import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import Slider from './Slider.vue'

async function flush() {
  await nextTick()
  await nextTick()
}

describe('Slider', () => {
  it('renders a single thumb with role="slider" for a single-value model', async () => {
    render(Slider, { props: { modelValue: [50] } })
    await flush()

    const thumbs = screen.getAllByRole('slider')
    expect(thumbs).toHaveLength(1)
  })

  it('renders one thumb per value for a range model', async () => {
    render(Slider, { props: { modelValue: [20, 50] } })
    await flush()

    const thumbs = screen.getAllByRole('slider')
    expect(thumbs).toHaveLength(2)
  })

  it('exposes min/max/step via ARIA on the thumb', async () => {
    render(Slider, {
      props: { modelValue: [10], min: 0, max: 200, step: 5 }
    })
    await flush()

    const thumb = screen.getByRole('slider')
    expect(thumb).toHaveAttribute('aria-valuemin', '0')
    expect(thumb).toHaveAttribute('aria-valuemax', '200')
    expect(thumb).toHaveAttribute('aria-valuenow', '10')
  })

  it('emits update:modelValue with an increased value on ArrowRight', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn<(value: number[] | undefined) => void>()

    render(Slider, {
      props: {
        modelValue: [50],
        min: 0,
        max: 100,
        step: 1,
        'onUpdate:modelValue': onUpdate
      }
    })
    await flush()

    screen.getByRole('slider').focus()
    await user.keyboard('{ArrowRight}')

    expect(onUpdate).toHaveBeenCalled()
    const latest = onUpdate.mock.calls.at(-1)?.[0]
    expect(latest?.[0]).toBeGreaterThan(50)
  })

  it('emits update:modelValue with a decreased value on ArrowLeft', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn<(value: number[] | undefined) => void>()

    render(Slider, {
      props: {
        modelValue: [50],
        min: 0,
        max: 100,
        step: 1,
        'onUpdate:modelValue': onUpdate
      }
    })
    await flush()

    screen.getByRole('slider').focus()
    await user.keyboard('{ArrowLeft}')

    expect(onUpdate).toHaveBeenCalled()
    const latest = onUpdate.mock.calls.at(-1)?.[0]
    expect(latest?.[0]).toBeLessThan(50)
  })

  it('respects step size when emitting updates', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn<(value: number[] | undefined) => void>()

    render(Slider, {
      props: {
        modelValue: [50],
        min: 0,
        max: 100,
        step: 10,
        'onUpdate:modelValue': onUpdate
      }
    })
    await flush()

    screen.getByRole('slider').focus()
    await user.keyboard('{ArrowRight}')

    expect(onUpdate).toHaveBeenCalledWith([60])
  })

  it('marks the root as disabled when disabled prop is set', async () => {
    const { container } = render(Slider, {
      props: { modelValue: [30], disabled: true }
    })
    await flush()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- Reka exposes disabled state as a data attribute on the root
    const root = container.querySelector('[data-slot="slider"]')
    expect(root).toHaveAttribute('data-disabled')
  })

  it('does not emit updates via keyboard when disabled', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(Slider, {
      props: {
        modelValue: [50],
        min: 0,
        max: 100,
        step: 1,
        disabled: true,
        'onUpdate:modelValue': onUpdate
      }
    })
    await flush()

    screen.getByRole('slider').focus()
    await user.keyboard('{ArrowRight}')

    expect(onUpdate).not.toHaveBeenCalled()
  })
})
