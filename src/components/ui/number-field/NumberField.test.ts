import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import NumberField from './NumberField.vue'
import NumberFieldDecrement from './NumberFieldDecrement.vue'
import NumberFieldIncrement from './NumberFieldIncrement.vue'
import NumberFieldInput from './NumberFieldInput.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderNumberField(rootAttrs: string, initialValue: number | null) {
  const value = ref(initialValue)
  const updates: unknown[] = []
  const Harness = defineComponent({
    components: {
      NumberField,
      NumberFieldDecrement,
      NumberFieldIncrement,
      NumberFieldInput
    },
    setup: () => ({
      value,
      onUpdate: (next: number) => {
        updates.push(next)
        value.value = next
      }
    }),
    template: `
      <NumberField :model-value="value" ${rootAttrs} @update:model-value="onUpdate">
        <NumberFieldDecrement />
        <NumberFieldInput aria-label="Amount" />
        <NumberFieldIncrement />
      </NumberField>
    `
  })
  render(Harness, { global: { plugins: [i18n] } })
  return { value, updates, input: screen.getByRole('spinbutton') }
}

describe('NumberField', () => {
  it('does not emit when the input is cleared and restores the value', async () => {
    const user = userEvent.setup()
    const { updates, input } = renderNumberField(':min="1"', 5)

    await user.clear(input)
    await user.tab()

    expect(updates).toEqual([])
    await waitFor(() => expect(input).toHaveValue('5'))
  })

  it('does not emit when focus leaves without a change', async () => {
    const user = userEvent.setup()
    const { updates, input } = renderNumberField('', 50)

    await user.click(input)
    await user.tab()

    expect(updates).toEqual([])
  })

  it('clamps a typed value to max on commit without step snapping', async () => {
    const user = userEvent.setup()
    const { updates, input } = renderNumberField(
      ':min="0" :max="10000" :step="5"',
      50
    )

    await user.clear(input)
    await user.type(input, '123{Enter}')
    expect(updates).toEqual([123])

    await user.clear(input)
    await user.type(input, '20000{Enter}')
    expect(updates).toEqual([123, 10000])
    expect(input).toHaveValue('10,000')
  })

  it('steps with buttons and arrow keys from a nullable value', async () => {
    const user = userEvent.setup()
    const { updates, input } = renderNumberField(
      ':min="1" :max="3" :step="0.2" :format-options="{ maximumFractionDigits: 1 }"',
      null
    )

    expect(input).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Increment' }))
    expect(updates).toEqual([1])

    await user.keyboard('{ArrowUp}')
    expect(updates).toEqual([1, 1.2])
    expect(input).toHaveAttribute('aria-valuenow', '1.2')

    await user.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(updates).toEqual([1, 1.2, 1])
    expect(screen.getByRole('button', { name: 'Decrement' })).toBeDisabled()
  })
})
