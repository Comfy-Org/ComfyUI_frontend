import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import CloudForgotPasswordView from '@/platform/cloud/onboarding/CloudForgotPasswordView.vue'

const mockSendPasswordReset = vi.fn()

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    sendPasswordReset: mockSendPasswordReset
  })
}))

async function renderView(): Promise<{ router: Router }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/cloud/forgot-password',
        name: 'cloud-forgot-password',
        component: CloudForgotPasswordView
      },
      {
        path: '/cloud/login',
        name: 'cloud-login',
        component: { template: '<div />' }
      }
    ]
  })
  await router.push('/cloud/forgot-password')
  await router.isReady()
  render(CloudForgotPasswordView, {
    global: {
      plugins: [
        router,
        createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
      ],
      // The view is exercised through its own logic; the PrimeVue widgets
      // are stubbed because new PrimeVue usage is banned.
      stubs: {
        InputText: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
        },
        Message: { template: '<div role="alert"><slot /></div>' }
      }
    }
  })
  return { router }
}

describe('CloudForgotPasswordView', () => {
  it('sends the reset for the entered email and confirms it', async () => {
    mockSendPasswordReset.mockResolvedValue(undefined)
    const user = userEvent.setup()
    await renderView()

    await user.type(
      screen.getByLabelText('cloudForgotPassword_emailLabel'),
      'a@b.example'
    )
    await user.click(
      screen.getByRole('button', {
        name: 'cloudForgotPassword_sendResetLink'
      })
    )

    expect(mockSendPasswordReset).toHaveBeenCalledWith('a@b.example')
    expect(
      screen.getByText('cloudForgotPassword_passwordResetSent')
    ).toBeInTheDocument()
  })

  it('shows the error copy and keeps the form usable when the reset fails', async () => {
    mockSendPasswordReset.mockRejectedValue(new Error('auth/user-not-found'))
    const user = userEvent.setup()
    await renderView()

    await user.type(
      screen.getByLabelText('cloudForgotPassword_emailLabel'),
      'a@b.example'
    )
    await user.click(
      screen.getByRole('button', {
        name: 'cloudForgotPassword_sendResetLink'
      })
    )

    expect(
      screen.getByText('cloudForgotPassword_passwordResetError')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('cloudForgotPassword_passwordResetSent')
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'cloudForgotPassword_sendResetLink'
      }),
      'a failed reset must release the loading state so the user can retry'
    ).toBeEnabled()
  })

  it('returns to login a few seconds after a successful reset', async () => {
    vi.useFakeTimers()
    mockSendPasswordReset.mockResolvedValue(undefined)
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms)
    })
    const { router } = await renderView()

    await user.type(
      screen.getByLabelText('cloudForgotPassword_emailLabel'),
      'a@b.example'
    )
    await user.click(
      screen.getByRole('button', {
        name: 'cloudForgotPassword_sendResetLink'
      })
    )
    await vi.advanceTimersByTimeAsync(3000)

    expect(router.currentRoute.value.name).toBe('cloud-login')
  })

  it('navigates back to login on request', async () => {
    const user = userEvent.setup()
    const { router } = await renderView()

    await user.click(
      screen.getByRole('button', {
        name: 'cloudForgotPassword_backToLogin'
      })
    )

    expect(router.currentRoute.value.name).toBe('cloud-login')
  })
})
