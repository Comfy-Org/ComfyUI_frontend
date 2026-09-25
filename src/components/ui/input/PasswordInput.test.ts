import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import PasswordInput from './PasswordInput.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

it('reveals and hides the password', async () => {
  const user = userEvent.setup()
  render(PasswordInput, {
    props: { modelValue: 'secret' },
    attrs: { 'aria-label': 'Password' },
    global: { plugins: [i18n] }
  })

  const input = screen.getByLabelText('Password')
  const toggle = screen.getByRole('button', { name: 'Show password' })
  expect(input).toHaveAttribute('type', 'password')

  await user.click(toggle)
  expect(input).toHaveAttribute('type', 'text')
  expect(toggle).toHaveAccessibleName('Hide password')

  await user.click(toggle)
  expect(input).toHaveAttribute('type', 'password')
})
