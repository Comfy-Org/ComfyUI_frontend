import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type {
  PlanRowAction,
  PlanRowState
} from '@comfyorg/account-core/billing'

import BillingPlanRow from './BillingPlanRow.vue'
import { planRowCopy } from './__fixtures__/copy'

function renderRow(
  state: PlanRowState,
  {
    action = 'manage',
    canManageSubscription = true,
    classes
  }: {
    action?: PlanRowAction | null
    canManageSubscription?: boolean
    classes?: { root?: string }
  } = {}
) {
  const onAction = vi.fn()
  render(BillingPlanRow, {
    props: {
      state,
      action,
      copy: planRowCopy,
      locale: 'en',
      canManageSubscription,
      classes,
      onAction
    }
  })
  return { onAction }
}

describe('BillingPlanRow', () => {
  it.for<{ case: string; state: PlanRowState; title: string; line: string }>([
    {
      case: 'an active monthly plan',
      state: {
        kind: 'active',
        planName: 'Pro',
        cadence: 'monthly',
        nextInvoice: '2026-11-20T00:00:00Z',
        scheduledChange: null
      },
      title: 'Pro',
      line: 'Billed monthly. Next invoice November 20.'
    },
    {
      case: 'an active yearly plan with a scheduled change',
      state: {
        kind: 'active',
        planName: 'Pro',
        cadence: 'yearly',
        nextInvoice: '2027-01-10T00:00:00Z',
        scheduledChange: {
          planName: 'Creator',
          effectiveAt: '2027-01-10T00:00:00Z'
        }
      },
      title: 'Pro',
      line: 'Billed yearly. Next invoice January 10, 2027. Changes to Creator on January 10, 2027.'
    },
    {
      case: 'an activating plan',
      state: { kind: 'activating', planName: 'Pro' },
      title: 'Pro',
      line: 'Activating your Pro plan…'
    },
    {
      case: 'a paused plan',
      state: { kind: 'paused', planName: 'Pro' },
      title: 'Pro',
      line: "Paused. The renewal payment didn't go through."
    },
    {
      case: 'an ending plan',
      state: {
        kind: 'ending',
        planName: 'Pro',
        cadence: 'monthly',
        endsAt: '2026-11-20T00:00:00Z'
      },
      title: 'Pro',
      line: "Ends November 20. You won't be charged again."
    },
    {
      case: 'an ended plan without a date',
      state: { kind: 'ended', planName: null, cadence: null, endedAt: null },
      title: 'Your plan',
      line: 'This plan has ended.'
    },
    {
      case: 'no plan with free runs left',
      state: { kind: 'noPlan', freeRuns: { remaining: 3, total: 5 } },
      title: 'This workspace has no active plan',
      line: 'You have 3 of 5 free runs left. Subscribe to keep running workflows after that.'
    },
    {
      case: 'no plan with free runs used',
      state: { kind: 'noPlan', freeRuns: { remaining: 0, total: 5 } },
      title: 'This workspace has no active plan',
      line: "You've used all 5 free runs. Subscribe to keep running workflows."
    },
    {
      case: 'a sales-managed plan with a renewal',
      state: {
        kind: 'salesManaged',
        planName: null,
        cadence: 'yearly',
        renewsAt: '2027-03-01T00:00:00Z'
      },
      title: 'Enterprise',
      line: 'Billed by contract. Renews March 1, 2027.'
    }
  ])('renders $case', ({ state, title, line }) => {
    renderRow(state)

    expect(screen.getByRole('heading', { name: title })).toBeTruthy()
    expect(screen.getByTestId('billing-plan-line').textContent.trim()).toBe(
      line
    )
  })

  it('renders no line for an unknown plan', () => {
    renderRow({ kind: 'unknown' })

    expect(screen.getByRole('heading', { name: 'Your plan' })).toBeTruthy()
    expect(screen.queryByTestId('billing-plan-line')).toBeNull()
  })

  it('tells a member who manages the plan', () => {
    renderRow(
      { kind: 'paused', planName: 'Pro' },
      { canManageSubscription: false }
    )

    expect(screen.getByTestId('billing-plan-line').textContent.trim()).toBe(
      "Paused. The renewal payment didn't go through. Managed by the workspace owner."
    )
  })

  it.for<{ action: PlanRowAction; label: string }>([
    { action: 'manage', label: 'Manage' },
    { action: 'subscribe', label: 'Subscribe' },
    { action: 'choosePlan', label: 'Choose a plan' },
    { action: 'contactSales', label: 'Contact sales' }
  ])('emits $action instead of navigating', async ({ action, label }) => {
    const { onAction } = renderRow({ kind: 'unknown' }, { action })

    await userEvent.click(screen.getByRole('button', { name: label }))

    expect(onAction).toHaveBeenCalledWith(action)
  })

  it('renders no action when the server offers none', () => {
    renderRow({ kind: 'unknown' }, { action: null })

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('lets the host replace the action and restyle the row', () => {
    render(BillingPlanRow, {
      props: {
        state: { kind: 'unknown' },
        action: 'manage',
        copy: planRowCopy,
        locale: 'en',
        canManageSubscription: true,
        classes: { root: 'host-root' }
      },
      slots: {
        action: `<template #action="{ label }"><a href="/plans">{{ label }}</a></template>`
      }
    })

    expect(screen.getByRole('link', { name: 'Manage' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTestId('billing-plan-row').className).toContain(
      'host-root'
    )
  })
})
