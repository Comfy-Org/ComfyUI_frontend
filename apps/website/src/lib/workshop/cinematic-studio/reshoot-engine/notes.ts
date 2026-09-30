import type { Locale } from '../../../../i18n/site'
import type { ReshootSize } from '../reshoot'
import { studioT as rc } from '../copy'
import type { ReshootQuote } from './transport'
import { ReshootError } from './transport'
import { sizeTier } from './workflow'

const HOUR = 3600
const DAY = 24 * HOUR

/** The rolling free-run period as a reader says it: today, this week, per 12 hours. */
function periodPhrase(seconds: number, locale: Locale): string {
  if (seconds === DAY) return rc('reshoot.period.day', {}, { locale: locale })
  if (seconds === 7 * DAY)
    return rc('reshoot.period.week', {}, { locale: locale })
  if (seconds % DAY === 0)
    return rc('reshoot.period.days', { n: seconds / DAY }, { locale: locale })
  return rc(
    'reshoot.period.hours',
    {
      n: Math.max(1, Math.round(seconds / HOUR))
    },
    { locale: locale }
  )
}

function relativeTime(seconds: number, locale: Locale): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (seconds < HOUR) return format.format(Math.ceil(seconds / 60), 'minute')
  if (seconds < 2 * DAY) return format.format(Math.ceil(seconds / HOUR), 'hour')
  return format.format(Math.ceil(seconds / DAY), 'day')
}

const credits = (price: number, locale: Locale) =>
  rc(
    'reshoot.quote.paid',
    {
      price: price.toLocaleString(locale)
    },
    { locale: locale }
  )

function exhausted(
  inSeconds: number | undefined,
  price: number,
  locale: Locale
): string {
  const when =
    inSeconds === undefined
      ? rc('reshoot.quote.later', {}, { locale: locale })
      : relativeTime(inSeconds, locale)
  const note = rc('reshoot.quote.exhausted', { when }, { locale: locale })
  return price > 0 ? `${note} · ${credits(price, locale)}` : note
}

/** The next Generate at this size, and its length once the clip is read. */
export interface ReshootRun {
  readonly size: ReshootSize
  readonly seconds?: number
}

const perSecondRate = (quote: ReshootQuote, size: ReshootSize) =>
  quote.price_per_second?.credits[sizeTier(size)]

/**
 * What one Generate costs in credits, rounded up as the proxy charges it.
 * Undefined while a per-second price still waits on the clip's length.
 */
export function runPrice(
  quote: ReshootQuote,
  run: ReshootRun
): number | undefined {
  if (!quote.price_per_second) return quote.price_credits
  const rate = perSecondRate(quote, run.size)
  if (rate === undefined || run.seconds === undefined) return undefined
  return Math.ceil(run.seconds * rate - 1e-9)
}

function priceText(quote: ReshootQuote, run: ReshootRun, locale: Locale) {
  const price = runPrice(quote, run)
  if (price !== undefined) return credits(price, locale)
  const rate = perSecondRate(quote, run.size)
  if (rate === undefined)
    return rc('reshoot.quote.priceUnknown', {}, { locale: locale })
  return rc(
    'reshoot.quote.perSecond',
    {
      rate: rate.toLocaleString(locale)
    },
    { locale: locale }
  )
}

/** What the next Generate costs, shown before it is pressed. */
export function quoteNote(
  quote: ReshootQuote,
  locale: Locale,
  run: ReshootRun,
  now = Date.now()
): string {
  const { free_runs_allowance: allowance } = quote
  if (quote.next_run === 'free')
    return allowance
      ? rc(
          'reshoot.quote.free',
          {
            left: quote.free_runs_remaining,
            runs: allowance.runs,
            period: periodPhrase(allowance.period_seconds, locale)
          },
          { locale: locale }
        )
      : rc('reshoot.quote.freeOnly', {}, { locale: locale })
  if (
    quote.next_run === 'paid' ||
    quote.blocked_reason === 'insufficient_credits'
  )
    return priceText(quote, run, locale)
  if (quote.blocked_reason === 'concurrent_run_limit')
    return rc('reshoot.error.busy', {}, { locale: locale })
  const resets = quote.resets_at ? Date.parse(quote.resets_at) : NaN
  return exhausted(
    Number.isFinite(resets) ? Math.max(0, (resets - now) / 1000) : undefined,
    runPrice(quote, run) ?? 0,
    locale
  )
}

/** Why a run did not happen, in the reader's words. */
export function failureNote(error: unknown, locale: Locale, price = 0): string {
  const code = error instanceof ReshootError ? error.code : ''
  const retry =
    error instanceof ReshootError ? error.retryAfterSeconds : undefined
  switch (code) {
    case 'free_runs_exhausted':
      return exhausted(retry, price, locale)
    case 'concurrent_run_limit':
      return rc('reshoot.error.busy', {}, { locale: locale })
    case 'unmetered_rate_limited':
    case 'upload_rate_limited':
      return rc(
        'reshoot.error.rateLimited',
        {
          when:
            retry === undefined
              ? rc('reshoot.quote.later', {}, { locale })
              : relativeTime(retry, locale)
        },
        { locale }
      )
    case 'app_unavailable':
    case 'not_found':
      return rc('reshoot.unavailable', {}, { locale: locale })
    case 'unauthorized':
      return rc('reshoot.signIn', {}, { locale: locale })
    default:
      return rc('reshoot.error.failed', {}, { locale: locale })
  }
}
