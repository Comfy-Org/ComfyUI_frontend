import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import EmailVerificationNudge from './EmailVerificationNudge.vue'

const h = vi.hoisted(() => ({
  composable: null as {
    isNudgeVisible: { value: boolean }
    canResend: { value: boolean }
    resend: ReturnType<typeof vi.fn>
    dismiss: ReturnType<typeof vi.fn>
  } | null
}))

vi.mock('@/composables/auth/useEmailVerification', async () => {
  const { ref } = await import('vue')
  h.composable = {
    isNudgeVisible: ref(false),
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
  h.composable!.isNudgeVisible.value = false
  h.composable!.canResend.value = true
  h.composable!.resend.mockReset()
  h.composable!.dismiss.mockReset()
})

const resendButton = () =>
  screen.getByRole('button', { name: 'Resend verification email' })

describe('EmailVerificationNudge', () => {
  it('renders nothing when there is no active nudge', () => {
    renderNudge()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders the nudge with resend and dismiss controls', async () => {
    h.composable!.isNudgeVisible.value = true
    renderNudge()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Verify your email to unlock account benefits'
    )

    await userEvent.click(resendButton())
    expect(h.composable!.resend).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(h.composable!.dismiss).toHaveBeenCalledOnce()
  })

  it('disables resend while on cooldown', () => {
    h.composable!.isNudgeVisible.value = true
    h.composable!.canResend.value = false
    renderNudge()

    expect(resendButton()).toBeDisabled()
  })
})
