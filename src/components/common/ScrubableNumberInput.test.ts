import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { beforeEach, expect, it } from 'vitest'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ScrubableNumberInput from './ScrubableNumberInput.vue'

let value: Ref<number>

beforeEach(() => {
  value = ref(3)
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
})

it('disables incrementing when a step reaches the maximum', async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Increase' }))
  expect(value.value).toBe(5)
  expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled()
})

it('clamps typed values above the maximum', async () => {
  const input = screen.getByRole('textbox', { name: 'Amount' })
  await fireEvent.update(input, '99')
  await fireEvent.blur(input)
  expect(value.value).toBe(5)
})

it('restores the current value after invalid text', async () => {
  const input = screen.getByRole('textbox', { name: 'Amount' })
  await fireEvent.update(input, 'invalid')
  await fireEvent.blur(input)
  expect(input).toHaveValue('3')
})

it('clamps keyboard stepping at the minimum and disables decrementing', async () => {
  screen.getByRole('textbox', { name: 'Amount' }).focus()
  await userEvent.keyboard('{PageDown}')
  expect(value.value).toBe(1)
  expect(screen.getByRole('button', { name: 'Decrease' })).toBeDisabled()
})
