import type { BillingTopUpDenial } from '@comfyorg/billing-core'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { paymentRecoveryAvailableFact } from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'

import ProfileMenuCreditsFlyout from '@/platform/account/components/ProfileMenuCreditsFlyout.vue'

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/billing/composables/usePaymentRecoveryDialog'))
vi.mock(import('@/platform/billing/composables/useProcessingTopupPayment'), () => ({
  useProcessingTopupPayment: () => ({ payment: computed(() => null) })
}))
vi.mock(import('@comfyorg/telemetry'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

type Served = {
  canTopUp: boolean
  denial?: BillingTopUpDenial
  paymentRecovery: boolean
}

function renderFlyout(served: Partial<Served> = {}) {
  const { canTopUp, denial, paymentRecovery } = {
    canTopUp: true,
    paymentRecovery: false,
    ...served
  }
  const capabilities = useBillingCapabilities()
  capabilities.canTopUp = computed(() => canTopUp)
  capabilities.topUpDenial = computed(() => denial)
  capabilities.paymentRecoveryAvailable =
    paymentRecoveryAvailableFact(paymentRecovery)
  vi.mocked(usePaymentRecoveryDialog).mockReturnValue({
    showPaymentRecoveryDialog: vi.fn(),
    updatePayment: vi.fn(),
    isUpdatingPayment: computed(() => false),
    paymentRecoveryLock: computed(() => null),
    refreshCapabilities: vi.fn(async () => undefined)
  })
  const onClose = vi.fn()
  const onOpenBilling = vi.fn()
  render(ProfileMenuCreditsFlyout, {
    props: { onClose, onOpenBilling },
    global: { plugins: [i18n] }
  })
  return { onClose, onOpenBilling }
}

const addCredits = () => screen.queryByRole('button', { name: 'Add credits' })

describe('ProfileMenuCreditsFlyout', () => {
  it('lets a workspace that can top up add credits, then closes the menu', async () => {
    const user = userEvent.setup()
    const { onClose } = renderFlyout()

    await user.click(addCredits()!)

    expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows a member no Add credits', () => {
    renderFlyout({ canTopUp: false, denial: 'not_workspace_owner' })

    expect(addCredits()).not.toBeInTheDocument()
  })

  it('dims Add credits with the reason while purchases are stopped', () => {
    renderFlyout({ canTopUp: false, denial: 'topup_purchases_paused' })

    expect(addCredits()).toBeDisabled()
    expect(addCredits()).toHaveAccessibleDescription(
      enMessages.credits.addCreditsRefusal.topupPurchasesPaused
    )
  })

  it.for([
    { name: 'offers Update payment when recovery is served', served: true },
    { name: 'offers no Update payment otherwise', served: false }
  ])('$name', ({ served }) => {
    renderFlyout({ canTopUp: false, paymentRecovery: served })

    expect(screen.queryByTestId('update-payment-button') !== null).toBe(served)
  })

  it('opens Billing settings', async () => {
    const user = userEvent.setup()
    const { onOpenBilling } = renderFlyout()

    await user.click(screen.getByRole('button', { name: 'Billing settings' }))

    expect(onOpenBilling).toHaveBeenCalledOnce()
  })
})
