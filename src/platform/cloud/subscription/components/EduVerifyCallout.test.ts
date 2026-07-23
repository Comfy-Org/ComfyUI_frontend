import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import EduVerifyCallout from './EduVerifyCallout.vue'

const mockNeedsEduVerification = ref(false)
const mockIsSending = ref(false)
const mockIsSent = ref(false)
const mockSendVerification = vi.fn()
const mockRefreshVerification = vi.fn()
const mockFetchStatus = vi.fn()
const mockCreateCustomer = vi.fn()

vi.mock('@/platform/cloud/subscription/composables/useEduPricing', () => ({
  useEduPricing: () => ({
    isEduPricingActive: computed(() => false),
    needsEduVerification: computed(() => mockNeedsEduVerification.value)
  })
}))

vi.mock('@/composables/auth/useEmailVerification', () => ({
  useEmailVerification: () => ({
    isSending: computed(() => mockIsSending.value),
    isSent: computed(() => mockIsSent.value),
    sendVerification: mockSendVerification,
    refreshVerification: mockRefreshVerification
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    fetchStatus: mockFetchStatus
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    createCustomer: mockCreateCustomer
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: {
        eduVerifyTitle: 'Student or educator?',
        eduVerifyHeader:
          'Verify your email to unlock up to {percent}% education pricing',
        eduVerifySend: 'Send verification email',
        eduVerifySentHint: 'Check your inbox, then come back',
        eduVerifyConfirm: "I've verified",
        eduVerifySendFailed: "Couldn't send the email. Try again.",
        eduVerifyStillUnverified:
          'Not verified yet. Click the link in your inbox first.',
        eduVerifyFailed: 'Something went wrong. Try again.'
      }
    }
  }
})

function renderComponent() {
  return render(EduVerifyCallout, {
    global: { plugins: [i18n, createTestingPinia({ createSpy: vi.fn })] }
  })
}

describe('EduVerifyCallout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNeedsEduVerification.value = false
    mockIsSending.value = false
    mockIsSent.value = false
    mockSendVerification.mockResolvedValue(true)
    mockRefreshVerification.mockResolvedValue(false)
    mockCreateCustomer.mockResolvedValue(undefined)
    mockFetchStatus.mockResolvedValue(undefined)
  })

  it('renders nothing unless the email needs verification', () => {
    renderComponent()
    expect(screen.queryByTestId('edu-verify-callout')).toBeNull()
  })

  it('renders the callout when the email needs verification', () => {
    mockNeedsEduVerification.value = true
    renderComponent()

    expect(screen.getByTestId('edu-verify-callout')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Send verification email' })
    ).toBeInTheDocument()
  })

  it('surfaces a send failure', async () => {
    const user = userEvent.setup()
    mockNeedsEduVerification.value = true
    mockSendVerification.mockResolvedValue(false)
    renderComponent()

    await user.click(
      screen.getByRole('button', { name: 'Send verification email' })
    )

    expect(
      screen.getByText("Couldn't send the email. Try again.")
    ).toBeInTheDocument()
  })

  it('surfaces a still-unverified status without re-provisioning', async () => {
    const user = userEvent.setup()
    mockNeedsEduVerification.value = true
    mockIsSent.value = true
    mockRefreshVerification.mockResolvedValue(false)
    renderComponent()

    await user.click(screen.getByRole('button', { name: "I've verified" }))

    expect(
      screen.getByText('Not verified yet. Click the link in your inbox first.')
    ).toBeInTheDocument()
    expect(mockCreateCustomer).not.toHaveBeenCalled()
  })

  it('ignores a second confirm click while one is in flight', async () => {
    const user = userEvent.setup()
    mockNeedsEduVerification.value = true
    mockIsSent.value = true
    let release!: (v: boolean) => void
    mockRefreshVerification.mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = resolve
      })
    )
    renderComponent()

    const confirm = screen.getByRole('button', { name: "I've verified" })
    await user.click(confirm)
    await user.click(confirm)
    release(true)

    await vi.waitFor(() => {
      expect(mockCreateCustomer).toHaveBeenCalledOnce()
    })
    expect(mockRefreshVerification).toHaveBeenCalledOnce()
  })

  it('re-provisions then refetches status once verified', async () => {
    const user = userEvent.setup()
    mockNeedsEduVerification.value = true
    mockIsSent.value = true
    mockRefreshVerification.mockResolvedValue(true)
    renderComponent()

    await user.click(screen.getByRole('button', { name: "I've verified" }))

    await vi.waitFor(() => {
      expect(mockCreateCustomer).toHaveBeenCalledOnce()
      expect(mockFetchStatus).toHaveBeenCalledOnce()
    })
    expect(mockCreateCustomer.mock.invocationCallOrder[0]).toBeLessThan(
      mockFetchStatus.mock.invocationCallOrder[0]
    )
  })
})
