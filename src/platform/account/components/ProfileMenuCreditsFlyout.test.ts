import type { PlanRowState } from '@comfyorg/account-core/billing'
import type { BillingTopUpDenial } from '@comfyorg/billing-core'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useBillingPlanRow } from '@/platform/billing/components/billingTab/useBillingPlanRow'
import type { BillingContext } from '@/platform/billing/composables/types'
import { paymentRecoveryAvailableFact } from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useTopUpPlanCreditCopy } from '@/platform/billing/composables/useTopUpPlanCreditCopy'

import ProfileMenuCreditsFlyout from '@/platform/account/components/ProfileMenuCreditsFlyout.vue'

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/components/billingTab/useBillingPlanRow'))
vi.mock(import('@/platform/billing/composables/useTopUpPlanCreditCopy'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/billing/composables/usePaymentRecoveryDialog'))
vi.mock(
  import('@/platform/billing/composables/useProcessingTopupPayment'),
  () => ({
    useProcessingTopupPayment: () => ({ payment: computed(() => null) })
  })
)
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
  balance: BillingContext['balance']['value']
  planKind: PlanRowState['kind']
  grant: BillingContext['periodCreditGrant']['value']
  planNote: string | null
}

const BALANCE: NonNullable<Served['balance']> = {
  amountMicros: 1100,
  currency: 'usd',
  effectiveBalanceMicros: 1100,
  cloudCreditBalanceMicros: 1000,
  prepaidBalanceMicros: 100
}

function serveBilling({
  balance,
  planKind,
  grant,
  planNote
}: Pick<Served, 'balance' | 'planKind' | 'grant' | 'planNote'>) {
  const context = useBillingContext()
  vi.mocked(useBillingContext).mockReturnValue({
    ...context,
    balance: computed(() => balance),
    billingStatus: computed(() => 'paid'),
    periodCreditGrant: computed(() => grant),
    nextCreditRefillAt: computed(() => '2026-10-28T00:00:00Z')
  })
  vi.mocked(useBillingPlanRow).mockReturnValue({
    state: computed(() => ({ kind: planKind }) as PlanRowState)
  })
  vi.mocked(useTopUpPlanCreditCopy).mockReturnValue(computed(() => planNote))
}

const DEFAULTS: Served = {
  canTopUp: true,
  paymentRecovery: false,
  balance: BALANCE,
  planKind: 'active',
  grant: { state: 'amount', credits: 8440, period: 'MONTHLY' },
  planNote: null
}

function renderFlyout(served: Partial<Served> = {}) {
  const { canTopUp, denial, paymentRecovery, ...billing } = {
    ...DEFAULTS,
    ...served
  }
  serveBilling(billing)
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
const textOf = (testId: string) =>
  screen.queryByTestId(testId)?.textContent.trim() ?? null

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

  it('dims Add credits and says to update payment while paused or payment is due', async () => {
    const user = userEvent.setup()
    renderFlyout({ canTopUp: false, denial: 'payment_past_due' })
    const reason = 'Update your payment method to add credits.'

    expect(addCredits()).toBeDisabled()
    expect(addCredits()).toHaveAccessibleDescription(reason)
    await user.hover(screen.getByTestId('add-credits-trigger'))
    expect(await screen.findByTestId('tooltip-content')).toHaveTextContent(
      reason
    )
  })

  it('shows no tooltip on Add credits while purchases are stopped', async () => {
    const user = userEvent.setup()
    renderFlyout({ canTopUp: false, denial: 'topup_purchases_paused' })

    await user.hover(screen.getByTestId('add-credits-trigger'))
    expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument()
  })

  it.for([
    { name: 'offers Update payment when recovery is served', served: true },
    { name: 'offers no Update payment otherwise', served: false }
  ])('$name', ({ served }) => {
    renderFlyout({ canTopUp: false, paymentRecovery: served })

    expect(screen.queryByTestId('update-payment-button') !== null).toBe(served)
  })

  it('shows the plan and top-up breakdown above the actions', () => {
    renderFlyout()

    expect(textOf('credits-breakdown-plan')).toBe('2,110 of 8,440')
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('75')
    expect(screen.getByText('Refills October 28')).toBeInTheDocument()
    expect(textOf('credits-breakdown-top-up')).toBe('211')
    expect(
      screen
        .getByTestId('credits-breakdown')
        .compareDocumentPosition(addCredits()!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('keeps the year on a yearly plan', () => {
    renderFlyout({
      grant: { state: 'amount', credits: 101280, period: 'ANNUAL' }
    })

    expect(screen.getByText('Refills October 28, 2026')).toBeInTheDocument()
  })

  it('shows no plan total or bar when the grant is unknown', () => {
    renderFlyout({ grant: { state: 'unknown' } })

    expect(textOf('credits-breakdown-plan')).toBe('2,110')
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  })

  it('shows top-up credits only, with the plan note, when there is no plan', () => {
    const note = enMessages.credits.topUp.planRequiredSubscribe
    renderFlyout({ planKind: 'noPlan', planNote: note })

    expect(screen.queryByText('Plan credits')).not.toBeInTheDocument()
    expect(textOf('credits-breakdown-top-up')).toBe('2,321')
    expect(screen.getByText(note)).toBeInTheDocument()
  })

  it('shows dashes and no Add credits when the balance is unavailable', () => {
    renderFlyout({ balance: null })

    expect(textOf('credits-breakdown-plan')).toBe('—')
    expect(textOf('credits-breakdown-top-up')).toBe('—')
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't load your balance."
    )
    expect(addCredits()).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Billing settings' })
    ).toBeInTheDocument()
  })

  it('opens Billing settings', async () => {
    const user = userEvent.setup()
    const { onOpenBilling } = renderFlyout()

    await user.click(screen.getByRole('button', { name: 'Billing settings' }))

    expect(onOpenBilling).toHaveBeenCalledOnce()
  })
})
