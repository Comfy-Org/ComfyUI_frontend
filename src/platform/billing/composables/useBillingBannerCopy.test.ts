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

function renderPlanNotStarted(banner: PlanNotStartedBanner) {
  const onAction = vi.fn()
  render(
    {
      setup() {
        const { copy, planNotStartedView } = useBillingBannerCopy()
        return () =>
          h(BillingBanner, {
            view: planNotStartedView(banner),
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

describe('useBillingBannerCopy plan not started banner', () => {
  it('names the served plan and offers a white Finish payment with no Dismiss', async () => {
    const { onAction } = renderPlanNotStarted({
      planTier: 'CREATOR',
      paymentPage: 'hostedPage'
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

  it('falls back to a generic title when no plan is served', () => {
    renderPlanNotStarted({ planTier: null, paymentPage: 'unknown' })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your plan hasn’t started'
    )
  })

  it.for([
    {
      case: 'offers Finish payment while the operation is unread or its read failed',
      paymentPage: 'unknown',
      finishPayment: 1
    },
    {
      case: 'offers no Finish payment when the operation serves no hosted payment page',
      paymentPage: 'noHostedPage',
      finishPayment: 0
    }
  ] as const)('$case', ({ paymentPage, finishPayment }) => {
    renderPlanNotStarted({ planTier: 'CREATOR', paymentPage })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your Creator plan hasn’t started'
    )
    expect(
      screen.queryAllByRole('button', { name: 'Finish payment' })
    ).toHaveLength(finishPayment)
  })
})
