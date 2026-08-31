import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import KnobControl from './KnobControl.vue'

describe('KnobControl', () => {
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
