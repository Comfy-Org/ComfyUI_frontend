import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import EmailVerificationNudge from './EmailVerificationNudge.vue'

const h = vi.hoisted(() => ({
  composable: null as {
    nudgeVariant: { value: 'credits' | 'generic' | null }
    canResend: { value: boolean }
    resend: ReturnType<typeof vi.fn>
    dismiss: ReturnType<typeof vi.fn>
  } | null
}))

vi.mock('@/composables/auth/useEmailVerification', async () => {
  const { ref } = await import('vue')
  h.composable = {
    nudgeVariant: ref(null),
    canResend: ref(true),
    resend: vi.fn(),
    dismiss: vi.fn()
  }
  return { useEmailVerification: () => h.composable }
})

function renderNudge() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(EmailVerificationNudge, { global: { plugins: [i18n] } })
}

beforeEach(() => {
  h.composable!.nudgeVariant.value = null
  h.composable!.canResend.value = true
  h.composable!.resend.mockReset()
  h.composable!.dismiss.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('EmailVerificationNudge', () => {
  it('renders nothing when there is no active nudge', () => {
    renderNudge()
    expect(screen.queryByTestId('email-verification-nudge')).toBeNull()
  })

  it('renders the generic nudge with resend and dismiss controls', async () => {
    h.composable!.nudgeVariant.value = 'generic'
    renderNudge()

    expect(screen.getByTestId('email-verification-nudge')).toBeTruthy()
    expect(
      screen.getByText('Verify your email to unlock account benefits')
    ).toBeTruthy()

    await userEvent.click(screen.getByTestId('email-verification-resend'))
    expect(h.composable!.resend).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByTestId('email-verification-dismiss'))
    expect(h.composable!.dismiss).toHaveBeenCalledOnce()
  })

  it('shows credit-specific copy without a dismiss control', () => {
    h.composable!.nudgeVariant.value = 'credits'
    renderNudge()

    expect(
      screen.getByText('Verify your email to receive free credits')
    ).toBeTruthy()
    expect(screen.queryByTestId('email-verification-dismiss')).toBeNull()
  })

  it('disables resend while on cooldown', () => {
    h.composable!.nudgeVariant.value = 'generic'
    h.composable!.canResend.value = false
    renderNudge()

    expect(
      screen.getByTestId('email-verification-resend').hasAttribute('disabled')
    ).toBe(true)
  })
})
