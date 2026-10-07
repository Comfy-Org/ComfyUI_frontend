import type { Locale } from '@/i18n/translations'
import type { ReshootSize } from '@/lib/workshop/cinematic-studio/reshoot'
import { translationsFor } from '@/i18n/translations'
import type { ReshootQuote } from './transport'
import { ReshootError } from './transport'
import { sizeTier } from './workflow'

const HOUR = 3600
const DAY = 24 * HOUR

/** The rolling free-run period as a reader says it: today, this week, per 12 hours. */
function periodPhrase(seconds: number, locale: Locale): string {
  const { t } = translationsFor(locale)
  if (seconds === DAY) return t('reshoot.period.day')
  if (seconds === 7 * DAY) return t('reshoot.period.week')
  if (seconds % DAY === 0) return t('reshoot.period.days', { n: seconds / DAY })
  return t('reshoot.period.hours', {
    n: Math.max(1, Math.round(seconds / HOUR))
  })
}

function relativeTime(seconds: number, locale: Locale): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (seconds < HOUR) return format.format(Math.ceil(seconds / 60), 'minute')
  if (seconds < 2 * DAY) return format.format(Math.ceil(seconds / HOUR), 'hour')
  return format.format(Math.ceil(seconds / DAY), 'day')
}

function credits(price: number, locale: Locale) {
  const { t } = translationsFor(locale)
  return t('reshoot.quote.paid', {
    price: price.toLocaleString(locale)
  })
}

function exhausted(
  inSeconds: number | undefined,
  price: number,
  locale: Locale
): string {
  const { t } = translationsFor(locale)
  const when =
    inSeconds === undefined
      ? t('reshoot.quote.later')
      : relativeTime(inSeconds, locale)
  const note = t('reshoot.quote.exhausted', { when })
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
  const { t } = translationsFor(locale)
  const price = runPrice(quote, run)
  if (price !== undefined) return credits(price, locale)
  const rate = perSecondRate(quote, run.size)
  if (rate === undefined) return t('reshoot.quote.priceUnknown')
  return t('reshoot.quote.perSecond', {
    rate: rate.toLocaleString(locale)
  })
}

/** What the next Generate costs, shown before it is pressed. */
export function quoteNote(
  quote: ReshootQuote,
  locale: Locale,
  run: ReshootRun,
  now = Date.now()
): string {
  const { t } = translationsFor(locale)
  const { free_runs_allowance: allowance } = quote
  if (quote.next_run === 'free')
    return allowance
      ? t('reshoot.quote.free', {
          left: quote.free_runs_remaining,
          runs: allowance.runs,
          period: periodPhrase(allowance.period_seconds, locale)
        })
      : t('reshoot.quote.freeOnly')
  if (
    quote.next_run === 'paid' ||
    quote.blocked_reason === 'insufficient_credits'
  )
    return priceText(quote, run, locale)
  if (quote.blocked_reason === 'concurrent_run_limit')
    return t('reshoot.error.busy')
  const resets = quote.resets_at ? Date.parse(quote.resets_at) : NaN
  return exhausted(
    Number.isFinite(resets) ? Math.max(0, (resets - now) / 1000) : undefined,
    runPrice(quote, run) ?? 0,
    locale
  )
}

/** Why a run did not happen, in the reader's words. */
export function failureNote(error: unknown, locale: Locale, price = 0): string {
  const { t } = translationsFor(locale)
  const code = error instanceof ReshootError ? error.code : ''
  const retry =
    error instanceof ReshootError ? error.retryAfterSeconds : undefined
  switch (code) {
    case 'free_runs_exhausted':
      return exhausted(retry, price, locale)
    case 'concurrent_run_limit':
      return t('reshoot.error.busy')
    case 'unmetered_rate_limited':
    case 'upload_rate_limited':
      return t('reshoot.error.rateLimited', {
        when:
          retry === undefined
            ? t('reshoot.quote.later')
            : relativeTime(retry, locale)
      })
    case 'app_unavailable':
    case 'not_found':
      return t('reshoot.unavailable')
    case 'unauthorized':
      return t('reshoot.signIn')
    default:
      return t('reshoot.error.failed')
  }
}
