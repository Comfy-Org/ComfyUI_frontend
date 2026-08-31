import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import PasswordFields from './PasswordFields.vue'

function renderFields(
  props: {
    password?: string
    confirmPassword?: string
    passwordError?: string
    confirmPasswordError?: string
  } = {}
) {
  return render(PasswordFields, {
    props: {
      password: '',
      confirmPassword: '',
      ...props
    },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
}

describe('PasswordFields', () => {
  it('shows password requirements when the password is edited', async () => {
    const user = userEvent.setup()
    renderFields()

    expect(
      screen.queryByText(enMessages.validation.password.requirements, {
        exact: false
      })
    ).not.toBeInTheDocument()

    await user.type(
      screen.getByLabelText(enMessages.auth.signup.passwordLabel),
      'P'
    )

    expect(
      screen.getByText(enMessages.validation.password.requirements, {
        exact: false
      })
    ).toBeInTheDocument()
  })

  it('associates a confirmation error with its input', () => {
    renderFields({
      passwordError: enMessages.validation.required,
      confirmPasswordError: enMessages.validation.password.match
    })

    expect(
      screen.getByLabelText(enMessages.auth.login.confirmPasswordLabel)
    ).toHaveAccessibleDescription(enMessages.validation.password.match)
    expect(
      screen.getByLabelText(enMessages.auth.signup.passwordLabel)
    ).toHaveAttribute('aria-invalid', 'true')
  })
})
