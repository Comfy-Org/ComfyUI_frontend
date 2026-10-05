import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import KnobControl from './KnobControl.vue'

describe('KnobControl', () => {
  it('normalizes both control arcs to 100 path units', () => {
    render(KnobControl, {
      props: { modelValue: 50 }
    })
    const track = screen.getByTestId('knob-track')
    const value = screen.getByTestId('knob-value')

    expect(track).toHaveAttribute('pathLength', '100')
    expect(track).toHaveAttribute('stroke-dasharray', '75 25')
    expect(value).toHaveAttribute('pathLength', '100')
    expect(value).toHaveAttribute('stroke-dasharray', '75 100')
  })

  it('steps with arrow keys and clamps to its range', async () => {
    const user = userEvent.setup()
    const { emitted } = render(KnobControl, {
      props: { modelValue: 9, min: 0, max: 10, step: 2 }
    })

    screen.getByRole('slider').focus()
    await user.keyboard('{ArrowRight}')

    expect(emitted()['update:modelValue']).toEqual([[10]])
  })

  it.for([
    {
      position: 'the bottom-left arc start',
      clientX: 0,
      clientY: 48,
      value: 0
    },
    { position: 'the top of the arc', clientX: 24, clientY: 0, value: 50 },
    {
      position: 'the bottom-right arc end',
      clientX: 48,
      clientY: 48,
      value: 100
    }
  ])(
    'maps a pointer press at $position across the 270 degree arc',
    async ({ clientX, clientY, value }) => {
      const user = userEvent.setup()
      const { emitted } = render(KnobControl, { props: { modelValue: 20 } })
      const slider = screen.getByRole('slider')
      vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, 48, 48)
      )

      await user.pointer({
        keys: '[MouseLeft>]',
        target: slider,
        coords: { clientX, clientY }
      })

      expect(emitted()['update:modelValue']).toEqual([[value]])
    }
  )

  it('ignores keyboard and pointer input and leaves the tab order when disabled', async () => {
    const user = userEvent.setup()
    const { emitted } = render(KnobControl, {
      props: { modelValue: 5, min: 0, max: 10, disabled: true }
    })
    const slider = screen.getByRole('slider')

    expect(slider).toHaveAttribute('aria-disabled', 'true')
    await user.tab()
    expect(slider).not.toHaveFocus()

    slider.focus()
    await user.keyboard('{ArrowRight}')
    await user.pointer({ keys: '[MouseLeft]', target: slider })

    expect(emitted()['update:modelValue']).toBeUndefined()
  })
})
