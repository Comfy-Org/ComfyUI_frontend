import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import UpdatePasswordContent from './UpdatePasswordContent.vue'

const updatePassword = vi.fn()
vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({ updatePassword })
}))

function renderContent(onSuccess = vi.fn()) {
  const user = userEvent.setup()
  const result = render(UpdatePasswordContent, {
    props: { onSuccess },
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
  return { ...result, user, onSuccess }
}

describe('UpdatePasswordContent', () => {
  it('blocks mismatched passwords and displays the error', async () => {
    const { user, onSuccess } = renderContent()

    await user.type(
      screen.getByLabelText(enMessages.auth.signup.passwordLabel),
      'Password1!'
    )
    await user.type(
      screen.getByLabelText(enMessages.auth.login.confirmPasswordLabel),
      'Different1!'
    )
    await user.click(
      screen.getByRole('button', {
        name: enMessages.userSettings.updatePassword
      })
    )

    expect(updatePassword).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(
      screen.getByLabelText(enMessages.auth.login.confirmPasswordLabel)
    ).toHaveAccessibleDescription(enMessages.validation.password.match)
  })

  it('updates a valid password and reports success', async () => {
    const { user, onSuccess } = renderContent()

    await user.type(
      screen.getByLabelText(enMessages.auth.signup.passwordLabel),
      'Password1!'
    )
    await user.type(
      screen.getByLabelText(enMessages.auth.login.confirmPasswordLabel),
      'Password1!'
    )
    await user.click(
      screen.getByRole('button', {
        name: enMessages.userSettings.updatePassword
      })
    )

    expect(updatePassword).toHaveBeenCalledWith('Password1!')
    expect(onSuccess).toHaveBeenCalledOnce()
  })
})
