import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { h, ref } from 'vue'

import EditorNumberField from './EditorNumberField.vue'

function renderField() {
  const value = ref(42)
  render({
    setup: () => () =>
      h(EditorNumberField, {
        label: 'Seed',
        modelValue: value.value,
        'onUpdate:modelValue': (next: number) => (value.value = next)
      })
  })
  return { value, input: screen.getByRole('spinbutton', { name: 'Seed' }) }
}

describe('EditorNumberField', () => {
  it('takes a whole, non-negative number', async () => {
    const { value, input } = renderField()

    await userEvent.clear(input)
    await userEvent.type(input, '7.4')
    await userEvent.tab()

    expect(value.value).toBe(7)
  })

  it.for([
    { typed: '-3', what: 'a negative number' },
    { typed: '-0.4', what: 'a negative fraction' },
    { typed: '{Backspace}', what: 'an empty field' }
  ])('puts the last good number back after $what', async ({ typed }) => {
    const { value, input } = renderField()

    await userEvent.clear(input)
    await userEvent.type(input, typed)
    await userEvent.tab()

    expect(value.value).toBe(42)
    expect(input).toHaveValue(42)
  })
})
