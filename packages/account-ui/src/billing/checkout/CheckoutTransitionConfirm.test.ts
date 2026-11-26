import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { SubscriptionPreview } from '@comfyorg/account-core/billing'

import CheckoutTransitionConfirm from './CheckoutTransitionConfirm.vue'
import { checkoutCopy } from './__fixtures__/copy'
import { exactPreview, plan } from './__fixtures__/preview'

type Props = InstanceType<typeof CheckoutTransitionConfirm>['$props']

function upgrade(overrides: Partial<SubscriptionPreview> = {}) {
  return exactPreview({
    transition_type: 'upgrade',
    current_plan: plan('STANDARD', 'MONTHLY', 2000, '2026-07-01T00:00:00Z'),
    new_plan: plan('CREATOR', 'MONTHLY', 3500, '2026-07-19T00:00:00Z'),
    ...overrides
  })
}

function renderTransition(props: Partial<Props> = {}) {
  return render(CheckoutTransitionConfirm, {
    props: {
      previewData: upgrade(),
      plan: { name: 'Creator', monthlyCredits: 7400 },
      currentPlanName: 'Standard',
      copy: checkoutCopy,
      locale: 'en',
      subscriptionLoaded: true,
      ...props
    }
  })
}

function confirmButton(name: string | RegExp): HTMLButtonElement {
  const button = screen.getByRole('button', { name })
  if (!(button instanceof HTMLButtonElement)) throw new Error('not a button')
  return button
}

describe('CheckoutTransitionConfirm', () => {
  it('renders an immediate upgrade with the charge today and the monthly refill', async () => {
    const onConfirm = vi.fn()
    renderTransition({ onConfirm })
    expect(screen.getByText('Confirm your upgrade')).toBeTruthy()
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('Switches today')).toBeTruthy()
    expect(screen.getByText('Each month credits refill to')).toBeTruthy()
    expect(screen.getByText('7,400')).toBeTruthy()
    expect(screen.getByText('$15.00')).toBeTruthy()
    await userEvent.click(confirmButton('Confirm upgrade'))
    expect(onConfirm).toHaveBeenCalledWith(false)
  })

  it('gives a yearly upgrade its credits up front', () => {
    renderTransition({
      previewData: upgrade({ new_plan: plan('CREATOR', 'ANNUAL', 33_600) })
    })
    expect(screen.getByText("Credits you'll get today")).toBeTruthy()
    expect(screen.getByText('88,800')).toBeTruthy()
    expect(screen.getByText('$336 Billed yearly')).toBeTruthy()
    expect(screen.getByText('Replaces your monthly refill.')).toBeTruthy()
  })

  it('describes a scheduled change by when it starts and what follows', () => {
    renderTransition({
      previewData: upgrade({
        transition_type: 'downgrade',
        is_immediate: false,
        effective_at: '2026-07-01T00:00:00Z',
        amount_due_cents: 0
      })
    })
    expect(screen.getByText('Review your scheduled change')).toBeTruthy()
    expect(screen.getByText('Starts Jul 1, 2026')).toBeTruthy()
    expect(screen.getByText('After that')).toBeTruthy()
    expect(screen.getByText('$35 billed each month.')).toBeTruthy()
    expect(confirmButton('Confirm change')).toBeTruthy()
  })

  it('lists the discounts that compose an immediate charge', () => {
    renderTransition({
      previewData: upgrade({
        discounts: [
          {
            kind: 'plan',
            code: 'TEAM10',
            name: '',
            amount_off_cents: 250
          }
        ]
      })
    })
    expect(screen.getByText('Discounts')).toBeTruthy()
    expect(screen.getByText(/TEAM10/).textContent).toContain('−$2.50')
  })

  it('reports the quote unavailable when an exact quote carries no currency', () => {
    renderTransition({ previewData: upgrade({ currency: undefined }) })
    expect(screen.getAllByText('Unavailable')).toHaveLength(2)
  })

  it('stays disabled until the subscription status has loaded', () => {
    renderTransition({ subscriptionLoaded: false })
    expect(confirmButton('Confirm upgrade').disabled).toBe(true)
  })

  it('does not confirm a stale quote in embedded checkout', () => {
    renderTransition({ embeddedCheckoutEnabled: true, quoteIsCurrent: false })
    expect(confirmButton('Confirm upgrade').disabled).toBe(true)
  })

  it('locks the change while an earlier payment awaits verification', () => {
    renderTransition({ actionUrl: 'https://bank.example/3ds' })
    expect(screen.getByRole('status').textContent).toContain(
      'A payment you started earlier needs you.'
    )
    expect(confirmButton('Confirm upgrade').disabled).toBe(true)
  })

  describe('cancel payment and try again', () => {
    const CANCEL = 'Cancel payment and try again'

    it.for([
      { paymentCancelable: true, offered: true },
      { paymentCancelable: false, offered: false },
      { paymentCancelable: undefined, offered: false }
    ])(
      'offers the cancel only when the server says so ($paymentCancelable)',
      ({ paymentCancelable, offered }) => {
        renderTransition({
          embeddedCheckoutEnabled: true,
          authenticationState: 'failed_retryable',
          ...(paymentCancelable === undefined ? {} : { paymentCancelable })
        })
        expect(screen.queryByRole('button', { name: CANCEL }) !== null).toBe(
          offered
        )
      }
    )

    it('asks the host to cancel once per click, even while the confirm is busy', async () => {
      const onCancelPayment = vi.fn()
      renderTransition({
        paymentCancelable: true,
        isLoading: true,
        onCancelPayment
      })
      await userEvent.click(confirmButton(CANCEL))
      expect(onCancelPayment).toHaveBeenCalledOnce()
    })

    it('holds the cancel while it is in flight', () => {
      renderTransition({ paymentCancelable: true, cancelingPayment: true })
      expect(confirmButton(CANCEL).disabled).toBe(true)
    })

    it("shows the host's failure sentence beside the cancel", () => {
      renderTransition({
        paymentCancelable: true,
        cancelPaymentError: 'This payment is already processing.'
      })
      expect(screen.getByRole('alert').textContent).toContain(
        'This payment is already processing.'
      )
    })
  })

  describe('reactivation', () => {
    function cancelled(overrides: Partial<SubscriptionPreview> = {}) {
      return upgrade({
        requires_reactivation_confirmation: true,
        cancel_at: '2026-07-01T00:00:00Z',
        ...overrides
      })
    }

    it.for([
      { served: true, banner: true },
      { served: false, banner: false },
      { served: undefined, banner: false }
    ])(
      'renders the banner only for a served requires_reactivation_confirmation (served $served)',
      ({ served, banner }) => {
        renderTransition({
          previewData: cancelled({
            requires_reactivation_confirmation: served
          })
        })
        expect(
          screen.queryByText('Reactivating your subscription') !== null
        ).toBe(banner)
        expect(
          screen.queryByRole('button', { name: /Confirm & reactivate/ }) !==
            null
        ).toBe(banner)
      }
    )

    it.for([
      { served: true, checkbox: true },
      { served: false, checkbox: false },
      { served: undefined, checkbox: false }
    ])(
      'asks for charge consent only for a served requires_reactivation_charge_confirmation (served $served)',
      ({ served, checkbox }) => {
        renderTransition({
          previewData: cancelled({
            amount_due_cents: 99_900,
            requires_reactivation_charge_confirmation: served
          })
        })
        expect(screen.queryByRole('checkbox') !== null).toBe(checkbox)
        expect(
          confirmButton('Confirm & reactivate — $999.00 today').disabled
        ).toBe(checkbox)
      }
    )

    it('names the served cancel_at, not the period end, as the end date', () => {
      renderTransition({
        previewData: cancelled({ cancel_at: '2026-06-15T00:00:00Z' })
      })
      expect(screen.getByText(/Your Standard was set to end/).textContent).toBe(
        'Your Standard was set to end on Jun 15, 2026. You will be charged $15.00 today and renew on Jul 19, 2026.'
      )
    })

    it('hides the banner when the preview carries no cancel_at to name', () => {
      renderTransition({ previewData: cancelled({ cancel_at: undefined }) })
      expect(screen.queryByText('Reactivating your subscription')).toBeNull()
    })

    it('discloses an upgrade reactivation with the charge in the confirm label', async () => {
      const onConfirm = vi.fn()
      renderTransition({
        previewData: cancelled({ amount_due_cents: 1500 }),
        onConfirm
      })
      expect(screen.getByText('Reactivating your subscription')).toBeTruthy()
      await userEvent.click(
        confirmButton('Confirm & reactivate — $15.00 today')
      )
      expect(onConfirm).toHaveBeenCalledWith(true)
    })

    it('renews on the server renewal date, the one the summary shows', () => {
      renderTransition({
        previewData: cancelled({
          cancel_at: '2026-10-25T00:00:00Z',
          effective_at: '2026-09-27T00:00:00Z',
          renewal_at: '2026-10-25T00:00:00Z',
          new_plan: plan('CREATOR', 'MONTHLY', 3500)
        })
      })
      expect(
        screen.getByText(/Your Standard was set to end on Oct 25, 2026/)
          .textContent
      ).toBe(
        'Your Standard was set to end on Oct 25, 2026. You will be charged $15.00 today and renew on Oct 25, 2026.'
      )
      expect(screen.getByText(/Renews at .* on Oct 25, 2026/)).toBeTruthy()
    })

    it('unlocks the confirm once the served charge consent is given', async () => {
      const onConfirm = vi.fn()
      renderTransition({
        previewData: cancelled({
          amount_due_cents: 4500,
          requires_reactivation_charge_confirmation: true
        }),
        onConfirm
      })
      const confirm = confirmButton('Confirm & reactivate — $45.00 today')
      expect(confirm.disabled).toBe(true)
      await userEvent.click(
        screen.getByRole('checkbox', {
          name: "I understand I'll be charged $45.00 today"
        })
      )
      expect(confirm.disabled).toBe(false)
      await userEvent.click(confirm)
      expect(onConfirm).toHaveBeenCalledWith(true)
    })

    it('drops the acknowledgement when a replacement quote arrives', async () => {
      const consentQuote = () =>
        cancelled({
          amount_due_cents: 4500,
          requires_reactivation_charge_confirmation: true
        })
      const { rerender } = renderTransition({ previewData: consentQuote() })
      await userEvent.click(screen.getByRole('checkbox'))
      await rerender({ previewData: consentQuote() })
      expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
      expect(confirmButton(/Confirm & reactivate/).disabled).toBe(true)
    })

    it('labels a downgrade reactivation without a charge', () => {
      renderTransition({
        previewData: cancelled({
          transition_type: 'downgrade',
          amount_due_cents: 0,
          requires_reactivation_charge_confirmation: false
        })
      })
      expect(screen.queryByRole('checkbox')).toBeNull()
      expect(confirmButton('Confirm & reactivate').disabled).toBe(false)
    })

    it('titles an annual duration change as a full year billed today', () => {
      renderTransition({
        previewData: cancelled({
          transition_type: 'duration_change',
          new_plan: plan('STANDARD', 'ANNUAL', 19_200)
        })
      })
      expect(
        screen.getByText(
          'Reactivating your subscription — full year billed today'
        )
      ).toBeTruthy()
    })

    it('leaves the renewal clause out when the quote carries no renewal date', () => {
      renderTransition({
        previewData: cancelled({
          effective_at: '2026-01-31T00:00:00Z',
          renewal_at: undefined,
          new_plan: plan('CREATOR', 'MONTHLY', 3500)
        })
      })
      expect(screen.getByText(/Your Standard was set to end/).textContent).toBe(
        'Your Standard was set to end on Jul 1, 2026. You will be charged $15.00 today and renew.'
      )
    })
  })
})
