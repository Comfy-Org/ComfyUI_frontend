import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import LoginButton from './LoginButton.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))

function renderButton({
  billingNewUxEnabled
}: {
  billingNewUxEnabled: boolean
}) {
  vi.mocked(useFeatureFlags().flags).billingNewUxEnabled = billingNewUxEnabled
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  render(LoginButton, { global: { plugins: [i18n] } })
  return userEvent.setup()
}

describe('LoginButton', () => {
  it('shows the Partner Nodes sign-in button and opens sign-in when the new billing UX is on', async () => {
    const user = renderButton({ billingNewUxEnabled: true })

    const button = screen.getByRole('button', {
      name: 'Sign in to use Partner Nodes'
    })
    await user.hover(button)
    expect(await screen.findByTestId('tooltip-content')).toHaveTextContent(
      'Sign in to use Partner Nodes'
    )
    expect(screen.queryByTestId('login-button-popover')).toBeNull()

    await user.click(button)
    expect(useCurrentUser().handleSignIn).toHaveBeenCalledOnce()
  })

  it('keeps the API Nodes login button and popover when the new billing UX is off', async () => {
    const user = renderButton({ billingNewUxEnabled: false })

    const button = screen.getByRole('button', { name: 'Login' })
    expect(screen.queryByText('Sign in to use Partner Nodes')).toBeNull()

    await user.hover(button)
    expect(
      await screen.findByText('Login to be able to use "API Nodes"')
    ).toBeInTheDocument()
  })
})
