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

interface LineContext {
  settings: AutoReloadSettings
  copy: AutoTopUpCardCopy
  locale: string
  rule: AutoTopUpLine[]
  tooltip: string
  budgetLine: (
    dated: (date: string) => string,
    undated: string
  ) => AutoTopUpLine
}

const statusOnly =
  (key: 'failed' | 'turnedOff' | AutoTopUpOffView) =>
  ({ copy }: LineContext): AutoTopUpLine[] => [{ text: copy[key] }]

const LINES: Record<
  AutoTopUpViewKey,
  (context: LineContext) => AutoTopUpLine[]
> = {
  failed: statusOnly('failed'),
  turnedOff: statusOnly('turnedOff'),
  off: statusOnly('off'),
  noPaymentMethod: statusOnly('noPaymentMethod'),
  noDefaultPaymentMethod: statusOnly('noDefaultPaymentMethod'),
  on_hold: ({ rule, copy }) => [...rule, { text: copy.onHold }],
  paused_by_budget: ({ rule, copy, settings, budgetLine }) => [
    ...rule,
    settings.paused_by_budget_remainder
      ? budgetLine(copy.pausedByRemainder, copy.pausedByRemainderNoDate)
      : budgetLine(copy.paused, copy.pausedNoDate)
  ],
  maximumReached: ({ rule, copy, budgetLine }) => [
    ...rule,
    budgetLine(copy.maximumReached, copy.maximumReachedNoDate)
  ],
  on: ({ rule, copy, settings, locale, tooltip }) =>
    settings.monthly_budget_cents === null
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

function linesFor(
  key: AutoTopUpViewKey,
  settings: AutoReloadSettings,
  copy: AutoTopUpCardCopy,
  locale: string
): AutoTopUpLine[] {
  const resetsAt = settings.cycle_resets_at
  const resetDay =
    resetsAt === null ? null : formatPlanDate(resetsAt, locale, 'monthly')
  const tooltip =
    resetDay === null ? copy.limitTooltipNoDate : copy.limitTooltip(resetDay)
  return LINES[key]({
    settings,
    copy,
    locale,
    rule: ruleLines(settings, copy, locale),
    tooltip,
    budgetLine: (dated, undated) => ({
      text: resetDay === null ? undated : dated(resetDay),
      tooltip
    })
  })
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
