import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import EditorSeedField from './EditorSeedField.vue'

const props = { label: 'Seed', shuffleLabel: 'New seed', modelValue: 42 }

describe('EditorSeedField', () => {
  it('takes a typed seed', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EditorSeedField, { props })
    const field = screen.getByRole('spinbutton', { name: 'Seed' })
    expect(field).toHaveValue(42)

    await user.clear(field)
    await user.type(field, '7{Tab}')

    expect(emitted('update:modelValue')).toEqual([[7]])
  })

  it('keeps the last seed when the field is cleared', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EditorSeedField, { props })
    const field = screen.getByRole('spinbutton', { name: 'Seed' })

    await user.clear(field)
    await user.tab()

    expect(emitted('update:modelValue')).toBeUndefined()
    expect(field).toHaveValue(42)
  })

  it('rolls a new seed from the dice inside the field', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { emitted } = render(EditorSeedField, { props })

    await userEvent.click(screen.getByRole('button', { name: 'New seed' }))

    expect(emitted('update:modelValue')).toEqual([[500_000_000]])
  })
})
