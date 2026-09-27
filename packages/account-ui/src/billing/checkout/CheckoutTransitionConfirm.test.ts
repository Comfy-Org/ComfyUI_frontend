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

  describe('reactivation', () => {
    it('shows no banner for a subscription that is not cancelled', () => {
      renderTransition()
      expect(screen.queryByText('Reactivating your subscription')).toBeNull()
    })

    it('discloses an upgrade reactivation with the charge in the confirm label', async () => {
      const onConfirm = vi.fn()
      renderTransition({
        subscriptionCancelled: true,
        subscriptionEndDate: '2026-07-01T00:00:00Z',
        previewData: upgrade({ amount_due_cents: 1500 }),
        onConfirm
      })
      expect(screen.getByText('Reactivating your subscription')).toBeTruthy()
      expect(
        screen.getByText(/Your Standard was set to end on Jul 1, 2026/)
          .textContent
      ).toBe(
        'Your Standard was set to end on Jul 1, 2026. You will be charged $15.00 today and renew on Jul 19, 2026.'
      )
      await userEvent.click(
        confirmButton('Confirm & reactivate — $15.00 today')
      )
      expect(onConfirm).toHaveBeenCalledWith(true)
    })

    it('requires the charge to be acknowledged when it exceeds the current monthly price', async () => {
      const onConfirm = vi.fn()
      renderTransition({
        forceReactivation: true,
        previewData: upgrade({ amount_due_cents: 4500 }),
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
      const { rerender } = renderTransition({
        forceReactivation: true,
        previewData: upgrade({ amount_due_cents: 4500 })
      })
      await userEvent.click(screen.getByRole('checkbox'))
      await rerender({ previewData: upgrade({ amount_due_cents: 4500 }) })
      expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
      expect(confirmButton(/Confirm & reactivate/).disabled).toBe(true)
    })

    it('never asks a downgrade to acknowledge a charge', () => {
      renderTransition({
        forceReactivation: true,
        previewData: upgrade({
          transition_type: 'downgrade',
          amount_due_cents: 9900
        })
      })
      expect(screen.queryByRole('checkbox')).toBeNull()
      expect(confirmButton('Confirm & reactivate').disabled).toBe(false)
    })

    it('titles an annual duration change as a full year billed today', () => {
      renderTransition({
        forceReactivation: true,
        previewData: upgrade({
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

    it.for([
      ['2026-01-31T00:00:00Z', 'MONTHLY', 'Feb 28, 2026'],
      ['2024-02-29T00:00:00Z', 'ANNUAL', 'Feb 28, 2025'],
      ['2026-03-31T00:00:00Z', 'MONTHLY', 'Apr 30, 2026']
    ] as const)(
      'clamps the renewal fallback from %s (%s) to %s',
      ([effectiveAt, duration, expected]) => {
        renderTransition({
          forceReactivation: true,
          previewData: upgrade({
            effective_at: effectiveAt,
            new_plan: plan('CREATOR', duration, 3500)
          })
        })
        expect(
          screen.getByText(/Your Standard was set to end/).textContent
        ).toContain(`renew on ${expected}`)
      }
    )

    it('hides the banner when the preview carries no current plan', () => {
      renderTransition({
        forceReactivation: true,
        previewData: upgrade({ current_plan: undefined })
      })
      expect(screen.queryByText('Reactivating your subscription')).toBeNull()
    })
  })
})
