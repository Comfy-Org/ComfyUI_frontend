import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ScrubableNumberInput from './ScrubableNumberInput.vue'

it('clamps stepping and typed values, restores invalid text, and disables boundary actions', async () => {
  const value = ref(3)
  render(
    {
      components: { ScrubableNumberInput },
      setup: () => ({ value }),
      template: `<ScrubableNumberInput v-model="value" :min="1" :max="5" :step="2" :input-attrs="{ 'aria-label': 'Amount' }" />`
    },
    {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: {
              en: { g: { increment: 'Increase', decrement: 'Decrease' } }
            }
          })
        ]
      }
    }
  )
  const input = screen.getByRole('textbox', { name: 'Amount' })
  await userEvent.click(screen.getByRole('button', { name: 'Increase' }))
  expect(value.value).toBe(5)
  expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled()
  await fireEvent.update(input, '99')
  await fireEvent.blur(input)
  expect(value.value).toBe(5)
  await fireEvent.update(input, 'invalid')
  await fireEvent.blur(input)
  expect(input).toHaveValue('5')
  input.focus()
  await userEvent.keyboard('{PageDown}')
  expect(value.value).toBe(1)
  expect(screen.getByRole('button', { name: 'Decrease' })).toBeDisabled()
})
