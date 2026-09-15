import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

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
})
