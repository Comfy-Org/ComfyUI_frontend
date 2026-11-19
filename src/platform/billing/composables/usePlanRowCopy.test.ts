import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  PlanRowAction,
  PlanRowState
} from '@comfyorg/account-core/billing'
import { BillingPlanRow } from '@comfyorg/account-ui/billing'

import enMessages from '@/locales/en/main.json'

import { usePlanRowCopy } from './usePlanRowCopy'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const MANAGED_BY_OWNER = 'Managed by the workspace owner.'

function renderRow(
  state: PlanRowState,
  action: PlanRowAction | null,
  canManageSubscription: boolean
) {
  render(
    {
      setup() {
        const copy = usePlanRowCopy()
        return () =>
          h(BillingPlanRow, {
            state,
            action,
            canManageSubscription,
            copy: copy.value,
            locale: 'en'
          })
      }
    },
    { global: { plugins: [i18n] } }
  )
  return {
    title: screen.getByRole('heading').textContent.trim(),
    line: screen.queryByTestId('billing-plan-line')?.textContent.trim() ?? null,
    action: screen.queryByRole('button')?.textContent.trim() ?? null
  }
}

const STATES: {
  case: string
  state: PlanRowState
  title: string
  ownerLine: string | null
  memberLine: string
}[] = [
  {
    case: 'active monthly',
    state: {
      kind: 'active',
      planName: 'Pro',
      cadence: 'monthly',
      nextInvoice: '2026-11-20T00:00:00Z',
      scheduledChange: null
    },
    title: 'Pro',
    ownerLine: 'Billed monthly. Next invoice November 20.',
    memberLine: `Billed monthly. Next invoice November 20. ${MANAGED_BY_OWNER}`
  },
  {
    case: 'active yearly with a scheduled change',
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
    ownerLine:
      'Billed yearly. Next invoice January 10, 2027. Changes to Creator on January 10, 2027.',
    memberLine: `Billed yearly. Next invoice January 10, 2027. Changes to Creator on January 10, 2027. ${MANAGED_BY_OWNER}`
  },
  {
    case: 'activating',
    state: { kind: 'activating', planName: 'Pro' },
    title: 'Pro',
    ownerLine: 'Activating your Pro plan…',
    memberLine: `Activating your Pro plan… ${MANAGED_BY_OWNER}`
  },
  {
    case: 'paused',
    state: { kind: 'paused', planName: 'Pro' },
    title: 'Pro',
    ownerLine: "Paused. The renewal payment didn't go through.",
    memberLine: `Paused. The renewal payment didn't go through. ${MANAGED_BY_OWNER}`
  },
  {
    case: 'ending',
    state: {
      kind: 'ending',
      planName: 'Pro',
      cadence: null,
      endsAt: '2026-11-20T00:00:00Z'
    },
    title: 'Pro',
    ownerLine: "Ends November 20, 2026. You won't be charged again.",
    memberLine: `Ends November 20, 2026. You won't be charged again. ${MANAGED_BY_OWNER}`
  },
  {
    case: 'ended with a date',
    state: {
      kind: 'ended',
      planName: 'Pro',
      cadence: 'monthly',
      endedAt: '2026-10-01T00:00:00Z'
    },
    title: 'Pro',
    ownerLine: 'Ended October 1.',
    memberLine: `Ended October 1. ${MANAGED_BY_OWNER}`
  },
  {
    case: 'ended without a date or name',
    state: { kind: 'ended', planName: null, cadence: null, endedAt: null },
    title: 'Your plan',
    ownerLine: 'This plan has ended.',
    memberLine: `This plan has ended. ${MANAGED_BY_OWNER}`
  },
  {
    case: 'no plan',
    state: { kind: 'noPlan', freeRuns: null },
    title: 'This workspace has no active plan',
    ownerLine:
      'Subscribe for monthly credits. You can also add credits any time.',
    memberLine: MANAGED_BY_OWNER
  },
  {
    case: 'no plan with free runs left',
    state: { kind: 'noPlan', freeRuns: { remaining: 2, total: 5 } },
    title: 'This workspace has no active plan',
    ownerLine:
      'You have 2 of 5 free runs left. Subscribe to keep running workflows after that.',
    memberLine: MANAGED_BY_OWNER
  },
  {
    case: 'no plan with free runs used',
    state: { kind: 'noPlan', freeRuns: { remaining: 0, total: 5 } },
    title: 'This workspace has no active plan',
    ownerLine:
      "You've used all 5 free runs. Subscribe to keep running workflows.",
    memberLine: MANAGED_BY_OWNER
  },
  {
    case: 'sales managed with a renewal',
    state: {
      kind: 'salesManaged',
      planName: 'Enterprise Plus',
      cadence: 'yearly',
      renewsAt: '2027-03-01T00:00:00Z'
    },
    title: 'Enterprise Plus',
    ownerLine: 'Billed by contract. Renews March 1, 2027.',
    memberLine: `Billed by contract. Renews March 1, 2027. ${MANAGED_BY_OWNER}`
  },
  {
    case: 'sales managed without a renewal or name',
    state: {
      kind: 'salesManaged',
      planName: null,
      cadence: null,
      renewsAt: null
    },
    title: 'Enterprise',
    ownerLine: 'Billed by contract.',
    memberLine: `Billed by contract. ${MANAGED_BY_OWNER}`
  },
  {
    case: 'unknown',
    state: { kind: 'unknown' },
    title: 'Your plan',
    ownerLine: null,
    memberLine: MANAGED_BY_OWNER
  }
]

describe('usePlanRowCopy', () => {
  it.for(STATES)(
    'renders $case for an owner',
    ({ state, title, ownerLine }) => {
      expect(renderRow(state, 'manage', true)).toEqual({
        title,
        line: ownerLine,
        action: 'Manage'
      })
    }
  )

  it.for(STATES)(
    'renders $case for a member',
    ({ state, title, memberLine }) => {
      expect(renderRow(state, 'manage', false)).toEqual({
        title,
        line: memberLine,
        action: 'Manage'
      })
    }
  )

  it.for<{ action: PlanRowAction | null; label: string | null }>([
    { action: 'manage', label: 'Manage' },
    { action: 'subscribe', label: 'Subscribe' },
    { action: 'choosePlan', label: 'Choose a plan' },
    { action: 'contactSales', label: 'Contact sales' },
    { action: null, label: null }
  ])('labels the $action action $label', ({ action, label }) => {
    expect(renderRow({ kind: 'unknown' }, action, true).action).toBe(label)
  })
})
