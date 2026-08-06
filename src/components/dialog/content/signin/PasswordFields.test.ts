import { Form } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { updatePasswordSchema } from '@/schemas/signInSchema'

import PasswordFields from './PasswordFields.vue'

const requirementsHeading = `${enMessages.validation.password.requirements}:`

const Host = defineComponent({
  setup() {
    return () =>
      h(Form, { resolver: zodResolver(updatePasswordSchema) }, () =>
        h(PasswordFields)
      )
  }
})

function renderComponent() {
  const user = userEvent.setup()
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  const utils = render(Host, { global: { plugins: [PrimeVue, i18n] } })
  return { ...utils, user }
}

const passwordInput = () =>
  screen.getByPlaceholderText(enMessages.auth.signup.passwordPlaceholder)
const requirements = () => screen.queryByText(requirementsHeading)

describe('PasswordFields', () => {
  it('hides the requirements once a valid password field loses focus', async () => {
    const { user } = renderComponent()

    await user.type(passwordInput(), 'Password1!')
    expect(requirements()).toBeInTheDocument()

    await user.tab()

    expect(requirements()).not.toBeInTheDocument()
  })

  it('shows the requirements again when the password field regains focus', async () => {
    const { user } = renderComponent()

    await user.type(passwordInput(), 'Password1!')
    await user.tab()
    await user.click(passwordInput())

    expect(requirements()).toBeInTheDocument()
  })

  it('keeps the requirements visible on blur while the password is invalid', async () => {
    const { user } = renderComponent()

    await user.type(passwordInput(), 'short')
    await user.tab()

    expect(requirements()).toBeInTheDocument()
  })

  it('does not show the requirements when focusing an untouched password field', async () => {
    const { user } = renderComponent()

    await user.click(passwordInput())

    expect(requirements()).not.toBeInTheDocument()
  })
})
