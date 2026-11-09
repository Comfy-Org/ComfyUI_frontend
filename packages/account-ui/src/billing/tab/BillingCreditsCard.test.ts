import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import type {
  AddCreditsAvailability,
  CreditsCardState,
  PlanCreditsState
} from '@comfyorg/account-core/billing'

import BillingCreditsCard from './BillingCreditsCard.vue'
import { creditsCardCopy } from './__fixtures__/creditsCardCopy'

const ENABLED: AddCreditsAvailability = { kind: 'enabled' }

const PLAN: PlanCreditsState = {
  kind: 'plan',
  availableCents: 700,
  planCents: 400,
  planPoolCredits: 1000,
  topUpCents: 300,
  topUpInUse: false,
  showUsage: true,
  planDate: { kind: 'refills', date: '2026-10-01T00:00:00Z' }
}

function renderCard(
  state: CreditsCardState,
  {
    addCredits = ENABLED,
    planCreditNote = null,
    classes
  }: {
    addCredits?: AddCreditsAvailability
    planCreditNote?: string | null
    classes?: { root?: string }
  } = {}
) {
  const onRetry = vi.fn()
  const onAddCredits = vi.fn()
  render(BillingCreditsCard, {
    props: {
      state,
      addCredits,
      planCreditNote,
      copy: creditsCardCopy,
      locale: 'en',
      classes,
      onRetry,
      onAddCredits
    }
  })
  return { onRetry, onAddCredits }
}

function textOf(testId: string): string | null {
  return screen.queryByTestId(testId)?.textContent.trim() ?? null
}

describe('BillingCreditsCard', () => {
  it.for<{
    case: string
    state: CreditsCardState
    available: string
    plan: string | null
    topUp: string | null
    date: string | null
    used: string | null
    inUse: boolean
    note: string | null
  }>([
    {
      case: 'a plan with plan and top-up pools',
      state: PLAN,
      available: '1,477',
      plan: '844 of 1,000',
      topUp: '633',
      date: 'Refills October 1, 2026',
      used: '16% used',
      inUse: false,
      note: null
    },
    {
      case: 'top-up in use after plan credits run out',
      state: {
        ...PLAN,
        availableCents: 1000,
        planCents: 0,
        topUpCents: 1000,
        topUpInUse: true
      },
      available: '2,110',
      plan: '0 of 1,000',
      topUp: '2,110',
      date: 'Refills October 1, 2026',
      used: '100% used',
      inUse: true,
      note: null
    },
    {
      case: 'a paused plan refilling after payment',
      state: {
        ...PLAN,
        planCents: 0,
        showUsage: false,
        planDate: { kind: 'afterPayment' }
      },
      available: '1,477',
      plan: '0 of 1,000',
      topUp: '633',
      date: 'Refills when the payment goes through',
      used: null,
      inUse: false,
      note: null
    },
    {
      case: 'an ending plan available until its end date',
      state: {
        ...PLAN,
        planDate: { kind: 'availableUntil', date: '2026-12-31T12:00:00Z' }
      },
      available: '1,477',
      plan: '844 of 1,000',
      topUp: '633',
      date: 'Available until December 31, 2026',
      used: '16% used',
      inUse: false,
      note: null
    },
    {
      case: 'a plan without a known pool',
      state: { ...PLAN, planPoolCredits: null },
      available: '1,477',
      plan: '844',
      topUp: '633',
      date: 'Refills October 1, 2026',
      used: null,
      inUse: false,
      note: null
    },
    {
      case: 'an overdrawn balance',
      state: { ...PLAN, availableCents: -100, planCents: 0, topUpCents: 0 },
      available: '-211',
      plan: '0 of 1,000',
      topUp: '0',
      date: 'Refills October 1, 2026',
      used: '100% used',
      inUse: false,
      note: 'Your runs used 211 more credits than you had.'
    },
    {
      case: 'no plan',
      state: { kind: 'noPlan', availableCents: 200 },
      available: '422',
      plan: null,
      topUp: null,
      date: null,
      used: null,
      inUse: false,
      note: null
    }
  ])('renders $case', (row) => {
    renderCard(row.state)

    expect(textOf('billing-credits-available')).toBe(row.available)
    expect(textOf('billing-credits-plan')).toBe(row.plan)
    expect(textOf('billing-credits-top-up')).toBe(row.topUp)
    expect(textOf('billing-credits-plan-date')).toBe(row.date)
    expect(textOf('billing-credits-plan-used')).toBe(row.used)
    expect(screen.queryByText('In use now') !== null).toBe(row.inUse)
    expect(
      screen.queryByText(/more credits? than you had/)?.textContent.trim() ??
        null
    ).toBe(row.note)
  })

  it('shows the served plan credit note', () => {
    renderCard(
      { kind: 'noPlan', availableCents: 200 },
      { planCreditNote: 'Subscribe to run workflows on Cloud.' }
    )

    expect(textOf('billing-credits-plan-note')).toBe(
      'Subscribe to run workflows on Cloud.'
    )
  })

  it('emits retry when the balance is unavailable', async () => {
    const { onRetry } = renderCard({ kind: 'unavailable' })

    expect(textOf('billing-credits-available')).toBe('—')
    expect(screen.getByRole('alert').textContent).toContain(
      "Couldn't load your balance."
    )
    expect(screen.queryByRole('button', { name: 'Add credits' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it.for<{ case: string; state: CreditsCardState }>([
    { case: 'a plan', state: PLAN },
    { case: 'no plan', state: { kind: 'noPlan', availableCents: 200 } }
  ])('emits addCredits on $case', async ({ state }) => {
    const { onAddCredits } = renderCard(state)

    await userEvent.click(screen.getByRole('button', { name: 'Add credits' }))

    expect(onAddCredits).toHaveBeenCalledOnce()
  })

  it.for<{ case: string; state: CreditsCardState }>([
    { case: 'a plan', state: PLAN },
    { case: 'no plan', state: { kind: 'noPlan', availableCents: 200 } }
  ])(
    'disables Add credits with the served reason on $case',
    async ({ state }) => {
      const { onAddCredits } = renderCard(state, {
        addCredits: {
          kind: 'disabled',
          reasonKey: 'credits.addCreditsRefusal.paymentPastDue'
        }
      })

      const button = screen.getByRole<HTMLButtonElement>('button', {
        name: 'Add credits'
      })
      expect(button.disabled).toBe(true)
      expect(button.getAttribute('aria-describedby')).toBe(
        screen.getByText('Update your payment method to add credits.').id
      )
      await userEvent.click(button)
      expect(onAddCredits).not.toHaveBeenCalled()
    }
  )

  it.for<{ variant: 'secondary' | 'inverted' }>([
    { variant: 'secondary' },
    { variant: 'inverted' }
  ])('renders Add credits as $variant', ({ variant }) => {
    render(BillingCreditsCard, {
      props: {
        state: PLAN,
        addCredits: ENABLED,
        planCreditNote: null,
        copy: creditsCardCopy,
        locale: 'en',
        addCreditsVariant: variant
      }
    })

    expect(screen.getByRole('button', { name: 'Add credits' }).className).toBe(
      cn(buttonVariants({ variant, size: 'md' }))
    )
  })

  it('hides Add credits when the server hides it', () => {
    renderCard(PLAN, { addCredits: { kind: 'hidden' } })

    expect(screen.queryByRole('button', { name: 'Add credits' })).toBeNull()
  })

  it('lets the host replace the actions and restyle the card', () => {
    render(BillingCreditsCard, {
      props: {
        state: { kind: 'unavailable' },
        addCredits: ENABLED,
        planCreditNote: null,
        copy: creditsCardCopy,
        locale: 'en',
        classes: { root: 'host-root' }
      },
      slots: {
        retry: `<template #retry="{ label }"><a href="/retry">{{ label }}</a></template>`
      }
    })

    expect(screen.getByRole('link', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.getByTestId('billing-credits-card').className).toContain(
      'host-root'
    )
  })

  it('lets the host render its own Add credits control', () => {
    render(BillingCreditsCard, {
      props: {
        state: PLAN,
        addCredits: ENABLED,
        planCreditNote: null,
        copy: creditsCardCopy,
        locale: 'en'
      },
      slots: {
        addCreditsAction: `<template #addCreditsAction="{ label }"><a href="/top-up">{{ label }}</a></template>`
      }
    })

    expect(screen.getByRole('link', { name: 'Add credits' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add credits' })).toBeNull()
  })
})
