import type { Locale } from '../../../../i18n/translations'
import { rc } from '../reshoot-copy'
import type { ReshootQuote } from './transport'
import { ReshootError } from './transport'

const HOUR = 3600
const DAY = 24 * HOUR

function fill(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    text
  )
}

/** The rolling free-run period as a reader says it: today, this week, per 12 hours. */
function periodPhrase(seconds: number, locale: Locale): string {
  if (seconds === DAY) return rc('reshoot.period.day', locale)
  if (seconds === 7 * DAY) return rc('reshoot.period.week', locale)
  if (seconds % DAY === 0)
    return fill(rc('reshoot.period.days', locale), { n: seconds / DAY })
  return fill(rc('reshoot.period.hours', locale), {
    n: Math.max(1, Math.round(seconds / HOUR))
  })
}

function relativeTime(seconds: number, locale: Locale): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (seconds < HOUR) return format.format(Math.ceil(seconds / 60), 'minute')
  if (seconds < 2 * DAY) return format.format(Math.ceil(seconds / HOUR), 'hour')
  return format.format(Math.ceil(seconds / DAY), 'day')
}

const credits = (price: number, locale: Locale) =>
  fill(rc('reshoot.quote.paid', locale), {
    price: price.toLocaleString(locale)
  })

function exhausted(
  inSeconds: number | undefined,
  price: number,
  locale: Locale
): string {
  const when =
    inSeconds === undefined
      ? rc('reshoot.quote.later', locale)
      : relativeTime(inSeconds, locale)
  const note = fill(rc('reshoot.quote.exhausted', locale), { when })
  return price > 0 ? `${note} · ${credits(price, locale)}` : note
}

/** What the next Generate costs, shown before it is pressed. */
export function quoteNote(
  quote: ReshootQuote,
  locale: Locale,
  now = Date.now()
): string {
  const { free_runs_allowance: allowance } = quote
  if (quote.next_run === 'free')
    return allowance
      ? fill(rc('reshoot.quote.free', locale), {
          left: quote.free_runs_remaining,
          runs: allowance.runs,
          period: periodPhrase(allowance.period_seconds, locale)
        })
      : rc('reshoot.quote.freeOnly', locale)
  if (
    quote.next_run === 'paid' ||
    quote.blocked_reason === 'insufficient_credits'
  )
    return credits(quote.price_credits, locale)
  if (quote.blocked_reason === 'concurrent_run_limit')
    return rc('reshoot.error.busy', locale)
  const resets = quote.resets_at ? Date.parse(quote.resets_at) : NaN
  return exhausted(
    Number.isFinite(resets) ? Math.max(0, (resets - now) / 1000) : undefined,
    quote.price_credits,
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
      return rc('reshoot.error.busy', locale)
    case 'unmetered_rate_limited':
    case 'upload_rate_limited':
      return fill(rc('reshoot.error.rateLimited', locale), {
        when:
          retry === undefined
            ? rc('reshoot.quote.later', locale)
            : relativeTime(retry, locale)
      })
    case 'app_unavailable':
    case 'not_found':
      return rc('reshoot.unavailable', locale)
    case 'unauthorized':
      return rc('reshoot.signIn', locale)
    default:
      return rc('reshoot.error.failed', locale)
  }
}
