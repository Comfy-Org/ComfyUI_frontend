import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import PasswordInput from './PasswordInput.vue'

it('reveals and hides the password', async () => {
  const user = userEvent.setup()
  render(PasswordInput, {
    props: {
      modelValue: 'secret',
      hidePasswordLabel: 'Hide password',
      showPasswordLabel: 'Show password'
    },
    attrs: { 'aria-label': 'Password' }
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

it('updates a controlled parent model when edited', async () => {
  const user = userEvent.setup()
  const Harness = defineComponent({
    components: { PasswordInput },
    setup: () => ({ password: ref('initial') }),
    template: `
      <PasswordInput v-model="password" aria-label="Password" hide-password-label="Hide password" show-password-label="Show password" />
      <output>{{ password }}</output>
    `
  })
  render(Harness)

  const input = screen.getByLabelText('Password')
  await user.clear(input)
  await user.type(input, 'changed')

  expect(screen.getByRole('status')).toHaveTextContent('changed')
})
