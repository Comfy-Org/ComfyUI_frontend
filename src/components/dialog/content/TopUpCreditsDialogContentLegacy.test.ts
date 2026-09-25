import { useToast } from '@/components/ui/toast'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@/platform/telemetry'
import { AuthStoreError } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'

import TopUpCreditsDialogContentLegacy from './TopUpCreditsDialogContentLegacy.vue'

const mockToastAdd = vi.hoisted(() => vi.fn())

const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: false }))

vi.mock(import('@/composables/auth/useAuthActions'))

vi.mock(import('@/composables/billing/useBillingRouting'))

vi.mock(import('@/platform/cloud/subscription/composables/useSubscription'))

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/platform/telemetry'))

const mockClearPendingTopup = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/composables/billing/usePendingTopup'), () => ({
  usePendingTopup: () => ({ clearPendingTopup: mockClearPendingTopup })
}))

beforeEach(() => {
  const toast = useToast()
  for (const kind of [
    'success',
    'error',
    'info',
    'warning',
    'loading'
  ] as const) {
    vi.mocked(toast[kind]).mockImplementation((...args) => {
      mockToastAdd(kind, ...args)
      return 0
    })
  }
})

vi.mock(import('@/base/credits/comfyCredits'), () => ({
  creditsToUsd: (credits: number) => credits,
  usdToCredits: (usd: number) => usd
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close', increment: 'Increment', decrement: 'Decrement' },
      credits: {
        topUp: {
          addMoreCredits: 'Add more credits',
          addMoreCreditsToRun: 'Add more credits to run',
          selectAmount: 'Select amount',
          youPay: 'You pay',
          youGet: 'You get',
          purchaseError: 'Purchase Failed',
          purchaseErrorDetail: 'Failed to purchase credits: {error}',
          unknownError: 'An unknown error occurred',
          minRequired: 'Minimum required',
          maxAllowed: 'Maximum allowed',
          needMore: 'Need more?',
          contactUs: 'Contact us',
          viewPricing: 'View pricing',
          insufficientWorkflowMessage: 'Insufficient credits',
          buyCredits: 'Continue to payment'
        }
      }
    }
  }
})

function renderDialog() {
  return render(TopUpCreditsDialogContentLegacy, {
    global: {
      config: { errorHandler: () => {} },
      plugins: [i18n]
    }
  })
}

async function clickBuyCredits() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Continue to payment' }))
}

describe('TopUpCreditsDialogContentLegacy', () => {
  beforeEach(() => {
    useBillingRouting().shouldUseWorkspaceBilling = computed(
      () => mockShouldUseWorkspaceBilling.value
    )
    vi.mocked(useSubscription().isSubscriptionEnabled).mockReturnValue(true)
    mockShouldUseWorkspaceBilling.value = false
  })

  it('shows Plan & Credits after a successful Cloud purchase', async () => {
    vi.mocked(useAuthActions().purchaseCreditsDirect).mockResolvedValue(
      undefined
    )

    renderDialog()
    await clickBuyCredits()

    expect(useAuthActions().purchaseCreditsDirect).toHaveBeenCalledWith(50)
    expect(useDialogStore().closeDialog).toHaveBeenCalled()
    expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
    expect(mockClearPendingTopup).not.toHaveBeenCalled()
  })

  it('clamps a typed amount to the ceiling and warns until another amount is chosen', async () => {
    renderDialog()
    const user = userEvent.setup()
    const payInput = screen.getByRole('spinbutton', { name: 'You pay' })

    await user.tripleClick(payInput)
    await user.keyboard('20000{Enter}')

    expect(payInput).toHaveValue('10,000')
    expect(screen.getByRole('spinbutton', { name: 'You get' })).toHaveValue(
      '10,000'
    )
    expect(screen.getByText('Maximum allowed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '$25' }))

    expect(payInput).toHaveValue('25')
    expect(screen.queryByText('Maximum allowed')).not.toBeInTheDocument()
  })

  it('steps the credits field by the amount tier without deselecting the preset on blur', async () => {
    renderDialog()
    const user = userEvent.setup()
    const payInput = screen.getByRole('spinbutton', { name: 'You pay' })

    await user.click(payInput)
    await user.tab()
    expect(screen.getByRole('button', { name: '$50' })).toHaveClass(
      'bg-secondary-background-selected'
    )

    const creditsIncrement = screen.getAllByRole('button', {
      name: 'Increment'
    })[1]
    await user.click(creditsIncrement)

    expect(payInput).toHaveValue('55')
    expect(screen.getByRole('button', { name: '$50' })).not.toHaveClass(
      'bg-secondary-background-selected'
    )
  })

  it('clears the pending top-up marker when the user closes the dialog', async () => {
    renderDialog()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(mockClearPendingTopup).toHaveBeenCalled()
    expect(useDialogStore().closeDialog).toHaveBeenCalled()
  })

  it('shows Plan & Credits when no billing rail is active', async () => {
    vi.mocked(useSubscription().isSubscriptionEnabled).mockReturnValue(false)
    vi.mocked(useAuthActions().purchaseCreditsDirect).mockResolvedValue(
      undefined
    )

    renderDialog()
    await clickBuyCredits()

    expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
  })

  it('shows the workspace settings panel when workspace billing is active', async () => {
    mockShouldUseWorkspaceBilling.value = true
    vi.mocked(useAuthActions().purchaseCreditsDirect).mockResolvedValue(
      undefined
    )

    renderDialog()
    await clickBuyCredits()

    expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
  })

  it('tracks the failure and surfaces a toast when the purchase rejects', async () => {
    vi.mocked(useAuthActions().purchaseCreditsDirect).mockRejectedValue(
      new Error('declined for person@example.com')
    )

    renderDialog()
    await clickBuyCredits()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'unknown'
    })
    expect(mockToastAdd).toHaveBeenCalledWith('error', 'Purchase Failed', {
      description: 'Failed to purchase credits: declined for person@example.com'
    })
    expect(useSettingsDialog().show).not.toHaveBeenCalled()
  })

  it('categorizes an auth-store rejection with an HTTP status via the shared classifier', async () => {
    const authStoreError = new AuthStoreError(
      'backend rejected the purchase',
      400
    )
    vi.mocked(useAuthActions().purchaseCreditsDirect).mockRejectedValue(
      authStoreError
    )

    renderDialog()
    await clickBuyCredits()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'api_rejected'
    })
  })

  it('categorizes an auth-store rejection with no HTTP status as a network failure', async () => {
    const authStoreError = new AuthStoreError('offline')
    vi.mocked(useAuthActions().purchaseCreditsDirect).mockRejectedValue(
      authStoreError
    )

    renderDialog()
    await clickBuyCredits()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'network'
    })
  })

  it('uses the same bounded category when the rejection is not an Error', async () => {
    vi.mocked(useAuthActions().purchaseCreditsDirect).mockRejectedValue('boom')

    renderDialog()
    await clickBuyCredits()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'unknown'
    })
  })
})
