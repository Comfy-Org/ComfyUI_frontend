import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  PlanCheckoutBanner,
  PlanNotStartedBanner
} from '@comfyorg/account-core/billing'
import {
  BillingBanner,
  planCheckoutBannerView
} from '@comfyorg/account-ui/billing'

import enMessages from '@/locales/en/main.json'

import { useBillingBannerCopy } from './useBillingBannerCopy'

const i18nPlugin = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderBanner(banner: PlanCheckoutBanner) {
  const onDismiss = vi.fn()
  render(
    {
      setup() {
        const { copy } = useBillingBannerCopy()
        return () =>
          h(BillingBanner, {
            view: planCheckoutBannerView(banner, copy.value),
            copy: copy.value,
            onDismiss
          })
      }
    },
    { global: { plugins: [i18nPlugin] } }
  )
  return { onDismiss }
}

function renderPlanNotStarted(
  banner: PlanNotStartedBanner,
  canOpenPlans = true
) {
  const onAction = vi.fn()
  render(
    {
      setup() {
        const { copy, planNotStartedView } = useBillingBannerCopy()
        return () =>
          h(BillingBanner, {
            view: planNotStartedView(banner, canOpenPlans),
            copy: copy.value,
            onAction
          })
      }
    },
    { global: { plugins: [i18nPlugin] } }
  )
  return { onAction }
}

describe('useBillingBannerCopy plan checkout banner', () => {
  it('links the bank check from a white Complete verification action with no Dismiss', () => {
    renderBanner({
      kind: 'verifyPayment',
      opId: 'op-1',
      actionUrl: 'https://pay.example/verify'
    })

    expect(screen.getByRole('status')).toHaveTextContent('Verify your payment')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your bank requires additional verification to complete this payment.'
    )
    const action = screen.getByRole('link', { name: 'Complete verification' })
    expect(action).toHaveAttribute('href', 'https://pay.example/verify')
    expect(action).toHaveAttribute('data-variant', 'inverted')
    expect(
      screen.queryByRole('button', { name: 'Dismiss' })
    ).not.toBeInTheDocument()
  })

  it.for<{
    case: string
    banner: PlanCheckoutBanner
    role: 'link' | 'button'
    name: string
  }>([
    {
      case: 'the verify action',
      banner: {
        kind: 'verifyPayment',
        opId: 'op-1',
        actionUrl: 'https://pay.example/verify'
      },
      role: 'link',
      name: 'Complete verification'
    },
    {
      case: 'Dismiss',
      banner: { kind: 'paymentReceived', opId: 'op-1' },
      role: 'button',
      name: 'Dismiss'
    }
  ])(
    'uses the 12px banner shell with an md $case',
    ({ banner, role, name }) => {
      renderBanner(banner)

      expect(screen.getByRole('status')).toHaveClass('rounded-xl', 'p-3')
      expect(screen.getByRole(role, { name })).toHaveClass('h-8')
    }
  )

  it('shows verify payment with no link when the operation omits action_url', () => {
    renderBanner({ kind: 'verifyPayment', opId: 'op-1', actionUrl: null })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows payment received without a payment link', () => {
    renderBanner({ kind: 'paymentReceived', opId: 'op-1' })

    expect(screen.getByRole('status')).toHaveTextContent('Payment received')
    expect(screen.getByRole('status')).toHaveTextContent(
      "Your plan is activating. You won't be charged again."
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('dismisses from the button', async () => {
    const { onDismiss } = renderBanner({
      kind: 'paymentReceived',
      opId: 'op-1'
    })

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

const CHECKOUT_URL =
  'https://billing.comfy.org/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=creator-monthly'

describe('useBillingBannerCopy plan not started banner', () => {
  it('names the served plan and offers a white Finish payment with no Dismiss', async () => {
    const { onAction } = renderPlanNotStarted({
      planTier: 'CREATOR',
      paymentPage: { kind: 'hostedPage' }
    })

    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Your Creator plan hasn’t started')
    expect(banner).toHaveTextContent('Finish paying to start it.')
    const action = screen.getByRole('button', { name: 'Finish payment' })
    expect(action).toHaveAttribute('data-variant', 'inverted')
    expect(
      screen.queryByRole('button', { name: 'Dismiss' })
    ).not.toBeInTheDocument()

    await userEvent.click(action)

    expect(onAction).toHaveBeenCalledWith('finishPayment')
  })

  it('links Complete verification to billing-web checkout when the operation serves only a client secret', () => {
    renderPlanNotStarted({
      planTier: 'CREATOR',
      paymentPage: { kind: 'clientSecretOnly', checkoutUrl: CHECKOUT_URL }
    })

    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Your Creator plan hasn’t started')
    expect(banner).toHaveTextContent('Finish paying to start it.')
    expect(
      screen.getByRole('link', { name: 'Complete verification' })
    ).toHaveAttribute('href', CHECKOUT_URL)
    expect(
      screen.queryByRole('button', { name: 'Finish payment' })
    ).not.toBeInTheDocument()
  })

  it('says the plan starts once the payment goes through and offers View on Plans when no way to pay loaded', async () => {
    const { onAction } = renderPlanNotStarted({
      planTier: null,
      paymentPage: { kind: 'unavailable' }
    })

    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Your plan hasn’t started')
    expect(banner).toHaveTextContent(
      'Your plan starts once the payment goes through.'
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'View on Plans' }))

    expect(onAction).toHaveBeenCalledWith('viewPlans')
  })

  it('offers no View on Plans when the server does not let this person open Plans', () => {
    renderPlanNotStarted(
      { planTier: null, paymentPage: { kind: 'unavailable' } },
      false
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your plan starts once the payment goes through.'
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
