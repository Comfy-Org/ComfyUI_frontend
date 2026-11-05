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
  if (view.disabled_reason === 'consecutive_declines') return 'turnedOff'
  if (view.status === 'paused_by_budget' && view.monthly_budget_is_default) {
    return 'maximumReached'
  }
  return STATUS[view.status]
}

function budgetLine(
  { cycle_resets_at: resetsAt }: AutoTopUpMemberView,
  locale: string,
  dated: (date: string) => string,
  undated: string
): string {
  return resetsAt === null
    ? undated
    : dated(formatPlanDate(resetsAt, locale, 'monthly'))
}

function lineOf(
  status: AutoTopUpStatusLabel,
  view: AutoTopUpMemberView,
  copy: AutoTopUpMemberBlockCopy,
  locale: string
): string | null {
  switch (status) {
    case 'on': {
      const { target_credits: target, threshold_credits: threshold } = view
      if (target === null || threshold === null) return null
      const credits = new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0
      })
      return copy.on(credits.format(target), credits.format(threshold))
    }
    case 'off':
      return copy.body
    case 'limitReached':
      return budgetLine(
        view,
        locale,
        copy.limitReached,
        copy.limitReachedNoDate
      )
    case 'maximumReached':
      return budgetLine(
        view,
        locale,
        copy.maximumReached,
        copy.maximumReachedNoDate
      )
    case 'failed':
    case 'turnedOff':
    case 'onHold':
      return copy[status]
  }
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
  const line = lineOf(status, view, copy, locale)
  return line === null ? null : { status, line }
}
