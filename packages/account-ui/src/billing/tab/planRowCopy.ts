import { formatPlanDate } from '@comfyorg/account-core/billing'
import type {
  PlanRowAction,
  PlanRowState
} from '@comfyorg/account-core/billing'

/** Host-translated strings for the plan row; dates arrive already formatted. */
export interface PlanRowCopy {
  readonly noPlanTitle: string
  readonly unknownTitle: string
  readonly salesManagedTitle: string
  readonly activating: (plan: string) => string
  readonly activeMonthly: (date: string) => string
  readonly activeYearly: (date: string) => string
  readonly scheduledChange: (plan: string, date: string) => string
  readonly paused: string
  readonly noPlanLine: string
  readonly freeRunsLeft: (remaining: number, total: number) => string
  readonly freeRunsUsed: (total: number) => string
  readonly salesManagedLine: string
  readonly salesManagedRenews: (date: string) => string
  readonly ending: (date: string) => string
  readonly ended: (date: string) => string
  readonly endedNoDate: string
  readonly managedByOwner: string
  readonly actions: Readonly<Record<PlanRowAction, string>>
}

export interface PlanRowText {
  title: string
  line: string
}

/** The plan row's title and status line for a served plan state. */
export function planRowText(
  state: PlanRowState,
  copy: PlanRowCopy,
  locale: string,
  canManageSubscription: boolean
): PlanRowText {
  const status = statusLine(state, copy, locale, canManageSubscription)
  return {
    title: titleFor(state, copy),
    line: canManageSubscription
      ? status
      : [status, copy.managedByOwner].filter(Boolean).join(' ')
  }
}

function titleFor(state: PlanRowState, copy: PlanRowCopy): string {
  switch (state.kind) {
    case 'noPlan':
      return copy.noPlanTitle
    case 'unknown':
      return copy.unknownTitle
    case 'ended':
      return state.planName ?? copy.unknownTitle
    case 'salesManaged':
      return state.planName ?? copy.salesManagedTitle
    default:
      return state.planName
  }
}

function statusLine(
  state: PlanRowState,
  copy: PlanRowCopy,
  locale: string,
  canManageSubscription: boolean
): string {
  switch (state.kind) {
    case 'activating':
      return copy.activating(state.planName)
    case 'active':
      return activeLine(state, copy, locale)
    case 'paused':
      return copy.paused
    case 'noPlan':
      return canManageSubscription ? noPlanLine(state, copy) : ''
    case 'salesManaged':
      return salesManagedLine(state, copy, locale)
    case 'ending':
      return copy.ending(formatPlanDate(state.endsAt, locale, state.cadence))
    case 'ended':
      return endedLine(state, copy, locale)
    default:
      return ''
  }
}

function salesManagedLine(
  state: Extract<PlanRowState, { kind: 'salesManaged' }>,
  copy: PlanRowCopy,
  locale: string
): string {
  if (!state.renewsAt) return copy.salesManagedLine
  return copy.salesManagedRenews(
    formatPlanDate(state.renewsAt, locale, state.cadence)
  )
}

function endedLine(
  state: Extract<PlanRowState, { kind: 'ended' }>,
  copy: PlanRowCopy,
  locale: string
): string {
  if (!state.endedAt) return copy.endedNoDate
  return copy.ended(formatPlanDate(state.endedAt, locale, state.cadence))
}

function activeLine(
  state: Extract<PlanRowState, { kind: 'active' }>,
  copy: PlanRowCopy,
  locale: string
): string {
  const date = formatPlanDate(state.nextInvoice, locale, state.cadence)
  const billed =
    state.cadence === 'monthly'
      ? copy.activeMonthly(date)
      : copy.activeYearly(date)
  if (!state.scheduledChange) return billed
  const change = copy.scheduledChange(
    state.scheduledChange.planName,
    formatPlanDate(state.scheduledChange.effectiveAt, locale, state.cadence)
  )
  return `${billed} ${change}`
}

function noPlanLine(
  state: Extract<PlanRowState, { kind: 'noPlan' }>,
  copy: PlanRowCopy
): string {
  if (!state.freeRuns) return copy.noPlanLine
  return state.freeRuns.remaining > 0
    ? copy.freeRunsLeft(state.freeRuns.remaining, state.freeRuns.total)
    : copy.freeRunsUsed(state.freeRuns.total)
}
