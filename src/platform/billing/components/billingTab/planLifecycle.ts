import type { PlanRowState } from '@/platform/billing/components/billingTab/planRow'

export type PlanLifecycleIntent =
  | {
      kind: 'stay'
      planName: string
      targetPlanName: string
      effectiveAt: string
    }
  | {
      kind: 'resume'
      planName: string
      renewsAt: string
    }

export type PlanCommandOutcome =
  | { ok: true }
  | { ok: false; serverMessage: string | null }

export type PlanConfirmState =
  | { phase: 'closed' }
  | { phase: 'confirming'; intent: PlanLifecycleIntent }
  | { phase: 'submitting'; intent: PlanLifecycleIntent }
  | {
      phase: 'refused'
      intent: PlanLifecycleIntent
      serverMessage: string | null
    }

export type PlanConfirmEvent =
  | { type: 'opened'; intent: PlanLifecycleIntent }
  | { type: 'submitted' }
  | { type: 'settled'; outcome: PlanCommandOutcome }
  | { type: 'dismissed' }

export const PLAN_CONFIRM_CLOSED: PlanConfirmState = { phase: 'closed' }

/** The Stay on {plan} confirmation for a row whose status carries a scheduled change. */
export function stayIntent(state: PlanRowState): PlanLifecycleIntent | null {
  if (state.kind !== 'active' || state.scheduledChange === null) return null
  return {
    kind: 'stay',
    planName: state.planName,
    targetPlanName: state.scheduledChange.planName,
    effectiveAt: state.scheduledChange.effectiveAt
  }
}

/** The Resume plan confirmation for a row whose plan is ending. */
export function resumeIntent(state: PlanRowState): PlanLifecycleIntent | null {
  if (state.kind !== 'ending') return null
  return {
    kind: 'resume',
    planName: state.planName,
    renewsAt: state.endsAt
  }
}

export function reducePlanConfirm(
  state: PlanConfirmState,
  event: PlanConfirmEvent
): PlanConfirmState {
  switch (event.type) {
    case 'opened':
      return state.phase === 'closed'
        ? { phase: 'confirming', intent: event.intent }
        : state
    case 'submitted':
      return state.phase === 'confirming' || state.phase === 'refused'
        ? { phase: 'submitting', intent: state.intent }
        : state
    case 'settled':
      if (state.phase !== 'submitting') return state
      return event.outcome.ok
        ? PLAN_CONFIRM_CLOSED
        : {
            phase: 'refused',
            intent: state.intent,
            serverMessage: event.outcome.serverMessage
          }
    case 'dismissed':
      return state.phase === 'submitting' ? state : PLAN_CONFIRM_CLOSED
  }
}
