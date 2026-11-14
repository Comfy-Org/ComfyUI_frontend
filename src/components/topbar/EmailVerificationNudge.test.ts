import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { useEmailVerification } from '@/composables/auth/useEmailVerification'
import enMessages from '@/locales/en/main.json'

import EmailVerificationNudge from './EmailVerificationNudge.vue'

type EmailVerification = ReturnType<typeof useEmailVerification>

const nudgeVisible = ref(false)
const emailVerification: EmailVerification = {
  needsEmailVerification: computed(() => nudgeVisible.value),
  isNudgeVisible: computed(() => nudgeVisible.value),
  canResend: ref(true),
  resend: vi.fn<EmailVerification['resend']>(),
  refresh: vi.fn<EmailVerification['refresh']>(),
  dismiss: vi.fn<EmailVerification['dismiss']>()
}

vi.mock(import('@/composables/auth/useEmailVerification'), () => ({
  useEmailVerification: () => emailVerification
}))

function renderNudge() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(EmailVerificationNudge, { global: { plugins: [i18n] } })
}

beforeEach(() => {
  nudgeVisible.value = false
  emailVerification.canResend.value = true
})

const resendButton = () =>
  screen.getByRole('button', { name: 'Resend verification email' })

describe('EmailVerificationNudge', () => {
  it('renders nothing when there is no active nudge', () => {
    renderNudge()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders the nudge with resend and dismiss controls', async () => {
    nudgeVisible.value = true
    renderNudge()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Please verify your email address'
    )

    await userEvent.click(resendButton())
    expect(emailVerification.resend).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(emailVerification.dismiss).toHaveBeenCalledOnce()
  })

  it('disables resend while on cooldown', () => {
    nudgeVisible.value = true
    emailVerification.canResend.value = false
    renderNudge()

    expect(resendButton()).toBeDisabled()
  })
})
