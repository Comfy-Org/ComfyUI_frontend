import { formatPlanDate } from '@comfyorg/account-core/billing'
import type { CapabilitiesSnapshot } from '@comfyorg/account-core/billing'

import type { AutoTopUpStatusLabel } from './autoTopUpCardView'

/** The member's auto top-up view as served on the capabilities read. */
export type AutoTopUpMemberView = NonNullable<
  CapabilitiesSnapshot['autoTopUpMemberView']
>

/** Host-translated strings for the auto top-up member block; `body` is the line when no status is served. */
export interface AutoTopUpMemberBlockCopy {
  readonly title: string
  readonly body: string
  readonly status: Readonly<Record<AutoTopUpStatusLabel, string>>
  readonly on: (target: string, threshold: string) => string
  readonly limitReached: (date: string) => string
  readonly limitReachedNoDate: string
  readonly maximumReached: (date: string) => string
  readonly maximumReachedNoDate: string
  readonly failed: string
  readonly turnedOff: string
  readonly onHold: string
}

export interface AutoTopUpMemberBlockView {
  status: AutoTopUpStatusLabel
  line: string
}

type ServedStatus = AutoTopUpMemberView['status']

const STATUS: Record<ServedStatus, AutoTopUpStatusLabel> = {
  off: 'off',
  on: 'on',
  on_hold: 'onHold',
  paused_by_budget: 'limitReached',
  failed: 'failed'
}

function isServedStatus(status: string): status is ServedStatus {
  return Object.hasOwn(STATUS, status)
}

function statusOf(view: AutoTopUpMemberView): AutoTopUpStatusLabel | null {
  if (!isServedStatus(view.status)) return null
  if (
    view.status === 'failed' &&
    view.disabled_reason === 'consecutive_declines'
  ) {
    return 'turnedOff'
  }
  if (view.status === 'paused_by_budget' && view.monthly_budget_is_default) {
    return 'maximumReached'
  }
  return STATUS[view.status]
}

interface LineContext {
  view: AutoTopUpMemberView
  copy: AutoTopUpMemberBlockCopy
  locale: string
}

function budgetLine(
  { view, locale }: LineContext,
  dated: (date: string) => string,
  undated: string
): string {
  const resetsAt = view.cycle_resets_at
  return resetsAt === null
    ? undated
    : dated(formatPlanDate(resetsAt, locale, 'monthly'))
}

function ruleLine({ view, copy, locale }: LineContext): string | null {
  const { target_credits: target, threshold_credits: threshold } = view
  if (target === null || threshold === null) return null
  const credits = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  return copy.on(credits.format(target), credits.format(threshold))
}

const LINES: Record<
  AutoTopUpStatusLabel,
  (context: LineContext) => string | null
> = {
  on: ruleLine,
  off: ({ copy }) => copy.body,
  limitReached: (context) =>
    budgetLine(
      context,
      context.copy.limitReached,
      context.copy.limitReachedNoDate
    ),
  maximumReached: (context) =>
    budgetLine(
      context,
      context.copy.maximumReached,
      context.copy.maximumReachedNoDate
    ),
  failed: ({ copy }) => copy.failed,
  turnedOff: ({ copy }) => copy.turnedOff,
  onHold: ({ copy }) => copy.onHold
}

/** The status and line for a served member view; null keeps the status-less block. */
export function autoTopUpMemberView(
  view: AutoTopUpMemberView | null | undefined,
  copy: AutoTopUpMemberBlockCopy,
  locale: string
): AutoTopUpMemberBlockView | null {
  if (!view) return null
  const status = statusOf(view)
  if (status === null) return null
  const line = LINES[status]({ view, copy, locale })
  return line === null ? null : { status, line }
}
