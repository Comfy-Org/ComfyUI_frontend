import { formatPlanDate } from '@comfyorg/account-core/billing'
import type {
  AutoTopUpCardAction,
  AutoTopUpCardState,
  AutoTopUpOffView
} from '@comfyorg/account-core/billing'

type AutoReloadSettings = Extract<
  AutoTopUpCardState,
  { kind: 'loaded' }
>['settings']
type ServedStatus = AutoReloadSettings['status']

export type AutoTopUpViewKey =
  | ServedStatus
  | 'turnedOff'
  | 'maximumReached'
  | AutoTopUpOffView

export type AutoTopUpStatusLabel =
  | 'failed'
  | 'turnedOff'
  | 'off'
  | 'on'
  | 'onHold'
  | 'limitReached'
  | 'maximumReached'

export type AutoTopUpActionLabel =
  | 'addPaymentMethod'
  | 'manage'
  | 'turnOn'
  | 'updatePayment'

/** Host-translated strings for the auto top-up card; numbers and dates arrive formatted. */
export interface AutoTopUpCardCopy {
  readonly title: string
  readonly unavailable: string
  readonly tryAgain: string
  readonly status: Readonly<Record<AutoTopUpStatusLabel, string>>
  readonly actions: Readonly<Record<AutoTopUpActionLabel, string>>
  readonly failed: string
  readonly turnedOff: string
  readonly off: string
  readonly noPaymentMethod: string
  readonly noDefaultPaymentMethod: string
  readonly onHold: string
  readonly rule: (target: string, threshold: string) => string
  readonly limit: (spent: string, limit: string) => string
  readonly limitTooltip: (date: string) => string
  readonly limitTooltipNoDate: string
  readonly paused: (date: string) => string
  readonly pausedNoDate: string
  readonly pausedByRemainder: (date: string) => string
  readonly pausedByRemainderNoDate: string
  readonly maximumReached: (date: string) => string
  readonly maximumReachedNoDate: string
}

export interface AutoTopUpLine {
  text: string
  tooltip?: string
}

export interface AutoTopUpCardView {
  key: AutoTopUpViewKey
  status: AutoTopUpStatusLabel
  action: AutoTopUpCardAction
  actionLabel: AutoTopUpActionLabel
  lines: AutoTopUpLine[]
}

const SERVED_STATUSES: ReadonlySet<string> = new Set<ServedStatus>([
  'failed',
  'off',
  'on_hold',
  'paused_by_budget',
  'on'
])

const KEYS = {
  failed: {
    status: 'failed',
    action: 'update_payment',
    actionLabel: 'updatePayment'
  },
  turnedOff: {
    status: 'turnedOff',
    action: 'update_payment',
    actionLabel: 'updatePayment'
  },
  off: { status: 'off', action: 'turn_on', actionLabel: 'turnOn' },
  on_hold: {
    status: 'onHold',
    action: 'update_payment',
    actionLabel: 'updatePayment'
  },
  paused_by_budget: {
    status: 'limitReached',
    action: 'manage',
    actionLabel: 'manage'
  },
  maximumReached: {
    status: 'maximumReached',
    action: 'manage',
    actionLabel: 'manage'
  },
  noPaymentMethod: {
    status: 'off',
    action: 'update_payment',
    actionLabel: 'addPaymentMethod'
  },
  noDefaultPaymentMethod: {
    status: 'off',
    action: 'update_payment',
    actionLabel: 'updatePayment'
  },
  on: { status: 'on', action: 'manage', actionLabel: 'manage' }
} as const satisfies Record<
  AutoTopUpViewKey,
  {
    status: AutoTopUpStatusLabel
    action: AutoTopUpCardAction
    actionLabel: AutoTopUpActionLabel
  }
>

/** The card's view for served settings; an unknown served status reads as off. */
export function autoTopUpViewKey(
  settings: AutoReloadSettings,
  offView: AutoTopUpOffView
): AutoTopUpViewKey {
  const { status } = settings
  if (!SERVED_STATUSES.has(status)) return 'off'
  if (status === 'off') return offView
  if (
    status === 'failed' &&
    settings.disabled_reason === 'consecutive_declines'
  ) {
    return 'turnedOff'
  }
  if (status === 'paused_by_budget' && settings.monthly_budget_is_default) {
    return 'maximumReached'
  }
  return status
}

/** The status, action and lines the card shows for served settings. */
export function autoTopUpCardView(
  settings: AutoReloadSettings,
  offView: AutoTopUpOffView,
  copy: AutoTopUpCardCopy,
  locale: string
): AutoTopUpCardView {
  const key = autoTopUpViewKey(settings, offView)
  return { key, ...KEYS[key], lines: linesFor(key, settings, copy, locale) }
}

function linesFor(
  key: AutoTopUpViewKey,
  settings: AutoReloadSettings,
  copy: AutoTopUpCardCopy,
  locale: string
): AutoTopUpLine[] {
  const day = (iso: string) => formatPlanDate(iso, locale, 'monthly')
  const resetsAt = settings.cycle_resets_at
  const tooltip =
    resetsAt === null
      ? copy.limitTooltipNoDate
      : copy.limitTooltip(day(resetsAt))
  const budgetLine = (
    dated: (date: string) => string,
    undated: string
  ): AutoTopUpLine => ({
    text: resetsAt === null ? undated : dated(day(resetsAt)),
    tooltip
  })
  const rule = ruleLines(settings, copy, locale)

  switch (key) {
    case 'failed':
    case 'turnedOff':
    case 'off':
    case 'noPaymentMethod':
    case 'noDefaultPaymentMethod':
      return [{ text: copy[key] }]
    case 'on_hold':
      return [...rule, { text: copy.onHold }]
    case 'paused_by_budget':
      return [
        ...rule,
        settings.paused_by_budget_remainder
          ? budgetLine(copy.pausedByRemainder, copy.pausedByRemainderNoDate)
          : budgetLine(copy.paused, copy.pausedNoDate)
      ]
    case 'maximumReached':
      return [
        ...rule,
        budgetLine(copy.maximumReached, copy.maximumReachedNoDate)
      ]
    case 'on':
      return settings.monthly_budget_cents === null
        ? rule
        : [
            ...rule,
            {
              text: copy.limit(
                usd(settings.spent_this_cycle_cents, locale),
                usd(settings.monthly_budget_cents, locale)
              ),
              tooltip
            }
          ]
  }
}

function ruleLines(
  { target_credits: target, threshold_credits: threshold }: AutoReloadSettings,
  copy: AutoTopUpCardCopy,
  locale: string
): AutoTopUpLine[] {
  if (target === null || threshold === null) return []
  const credits = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  return [
    { text: copy.rule(credits.format(target), credits.format(threshold)) }
  ]
}

function usd(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(cents / 100)
}
