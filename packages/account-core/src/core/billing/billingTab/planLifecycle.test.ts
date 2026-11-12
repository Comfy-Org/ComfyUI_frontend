import { describe, expect, it } from 'vitest'

import {
  PLAN_CONFIRM_CLOSED,
  reducePlanConfirm,
  resumeIntent,
  stayIntent
} from './planLifecycle'
import type {
  PlanConfirmEvent,
  PlanConfirmState,
  PlanLifecycleIntent
} from './planLifecycle'
import type { PlanRowState } from './planRow'

const intent: PlanLifecycleIntent = {
  kind: 'resume',
  planName: 'Pro',
  renewsAt: '2026-10-28T00:00:00Z'
}

const confirming: PlanConfirmState = { phase: 'confirming', intent }
const submitting: PlanConfirmState = { phase: 'submitting', intent }
const refused: PlanConfirmState = {
  phase: 'refused',
  intent,
  serverMessage: 'Only the original owner can change the plan.'
}

const opened: PlanConfirmEvent = { type: 'opened', intent }
const submitted: PlanConfirmEvent = { type: 'submitted' }
const accepted: PlanConfirmEvent = {
  type: 'settled',
  outcome: { ok: true }
}
const declined: PlanConfirmEvent = {
  type: 'settled',
  outcome: {
    ok: false,
    serverMessage: 'Only the original owner can change the plan.'
  }
}
const dismissed: PlanConfirmEvent = { type: 'dismissed' }

describe('reducePlanConfirm', () => {
  it.for<[string, PlanConfirmState, PlanConfirmEvent, PlanConfirmState]>([
    ['opens from closed', PLAN_CONFIRM_CLOSED, opened, confirming],
    ['submits a confirmation', confirming, submitted, submitting],
    ['retries after a refusal', refused, submitted, submitting],
    [
      'closes when the server accepts',
      submitting,
      accepted,
      PLAN_CONFIRM_CLOSED
    ],
    ['keeps the dialog with the refusal', submitting, declined, refused],
    ['dismisses a confirmation', confirming, dismissed, PLAN_CONFIRM_CLOSED],
    ['dismisses a refusal', refused, dismissed, PLAN_CONFIRM_CLOSED],
    ['holds the dialog while submitting', submitting, dismissed, submitting],
    ['ignores a second open', confirming, opened, confirming],
    ['ignores a double submit', submitting, submitted, submitting],
    ['ignores a stray settle', confirming, accepted, confirming],
    [
      'ignores a submit while closed',
      PLAN_CONFIRM_CLOSED,
      submitted,
      PLAN_CONFIRM_CLOSED
    ]
  ])('%s', ([, state, event, expected]) => {
    expect(reducePlanConfirm(state, event)).toEqual(expected)
  })
})

describe('plan lifecycle intents', () => {
  const active: PlanRowState = {
    kind: 'active',
    planName: 'Pro',
    cadence: 'monthly',
    nextInvoice: '2026-10-28T00:00:00Z',
    scheduledChange: null
  }
  const ending: PlanRowState = {
    kind: 'ending',
    planName: 'Pro',
    cadence: 'monthly',
    endsAt: '2026-10-28T00:00:00Z'
  }

  it('offers Stay with the target and date the scheduled change carries', () => {
    expect(
      stayIntent({
        ...active,
        scheduledChange: {
          planName: 'Creator',
          effectiveAt: '2026-10-28T00:00:00Z'
        }
      })
    ).toEqual({
      kind: 'stay',
      planName: 'Pro',
      targetPlanName: 'Creator',
      effectiveAt: '2026-10-28T00:00:00Z'
    })
  })

  it('offers Resume with the date the plan ends', () => {
    expect(resumeIntent(ending)).toEqual({
      kind: 'resume',
      planName: 'Pro',
      renewsAt: '2026-10-28T00:00:00Z'
    })
  })

  it.for<[string, PlanRowState]>([
    ['an active plan with no scheduled change', active],
    ['an ending plan', ending],
    ['no plan', { kind: 'noPlan', freeRuns: null }]
  ])('offers no Stay for %s', ([, state]) => {
    expect(stayIntent(state)).toBeNull()
  })

  it.for<[string, PlanRowState]>([
    ['an active plan', active],
    [
      'an ended plan',
      {
        kind: 'ended',
        planName: 'Pro',
        cadence: null,
        endedAt: '2026-10-28T00:00:00Z'
      }
    ],
    ['an unknown plan', { kind: 'unknown' }]
  ])('offers no Resume for %s', ([, state]) => {
    expect(resumeIntent(state)).toBeNull()
  })
})
