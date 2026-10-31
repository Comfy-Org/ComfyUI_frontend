import { useTelemetry } from '@comfyorg/telemetry'
import type {
  FetchStatusRetryMetadata,
  FetchStatusRetryOutcome
} from '@comfyorg/telemetry/types'

import { getFetchRouteTemplate } from './fetchRouteTemplate'
import type { RetryStopReason } from './retryPolicy'

/** How a request's retry loop ended. */
export type StatusRetryEnd =
  | 'answered'
  | Exclude<RetryStopReason, 'not_retryable'>
  | 'timeout'
  | 'network'
  | 'cancelled'

export interface StatusRetrySettlement {
  readonly end: StatusRetryEnd
  /** Requests sent, including the first. */
  readonly attempts: number
  readonly finalStatus?: number
  /** Whether an earlier answer was retryable and a retry was scheduled. */
  readonly retryScheduled: boolean
}

function isSuccessfulStatus(status: number | undefined): boolean {
  return status !== undefined && status >= 200 && status < 300
}

/** The outcome to record for a settled request, or `undefined` for none. */
export function classifyStatusRetry({
  end,
  attempts,
  finalStatus,
  retryScheduled
}: StatusRetrySettlement): FetchStatusRetryOutcome | undefined {
  switch (end) {
    case 'cancelled':
      return undefined
    case 'retry_after_too_long':
      return end
    case 'attempts_spent':
      return attempts > 1 ? 'exhausted' : undefined
    case 'timeout':
      return retryScheduled ? 'timeout_budget' : undefined
    case 'network':
      return retryScheduled ? 'failed' : undefined
    case 'answered':
      if (!retryScheduled) return undefined
      return isSuccessfulStatus(finalStatus) ? 'recovered' : 'failed'
  }
}

/** How the loop ended when it stopped on an answer. */
export function endForStop(reason: RetryStopReason): StatusRetryEnd {
  return reason === 'not_retryable' ? 'answered' : reason
}

const MAX_EVENTS_PER_KEY_PER_WINDOW = 20
const BUDGET_WINDOW_MS = 60_000
const budgetPerKey = new Map<string, { windowStart: number; sent: number }>()

/** Forgets how many events each key has sent. */
export function clearStatusRetryBudget(): void {
  budgetPerKey.clear()
}

function spendBudget(key: string): boolean {
  const now = Date.now()
  const budget = budgetPerKey.get(key)
  if (!budget || now - budget.windowStart >= BUDGET_WINDOW_MS) {
    budgetPerKey.set(key, { windowStart: now, sent: 1 })
    return true
  }
  if (budget.sent >= MAX_EVENTS_PER_KEY_PER_WINDOW) return false
  budget.sent += 1
  return true
}

function telemetryHost(host: string): string {
  const knownHost =
    host === location.host ||
    host === 'comfy.org' ||
    host.endsWith('.comfy.org')
  return knownHost ? host : 'other'
}

function describeUrl(
  url: string
): Pick<FetchStatusRetryMetadata, 'host' | 'route'> {
  const parsed = new URL(url, location.href)
  return {
    host: telemetryHost(parsed.host),
    route: getFetchRouteTemplate(parsed.pathname)
  }
}

interface StatusRetryReport extends StatusRetrySettlement {
  readonly transport: FetchStatusRetryMetadata['transport']
  readonly method: string
  readonly url: () => string
}

function recordStatusRetry(report: StatusRetryReport): void {
  const outcome = classifyStatusRetry(report)
  const telemetry = useTelemetry()
  if (!outcome || !telemetry) return
  const { host, route } = describeUrl(report.url())
  if (!spendBudget(`${host} ${route} ${outcome}`)) return

  telemetry.trackFetchStatusRetry({
    transport: report.transport,
    method: report.method.toUpperCase(),
    host,
    route,
    attempts: report.attempts,
    ...(report.finalStatus !== undefined && {
      final_status: report.finalStatus
    }),
    outcome
  })
}

/** Records one settled request that hit a retryable status; never throws. */
export function trackStatusRetry(report: StatusRetryReport): void {
  try {
    recordStatusRetry(report)
  } catch (error) {
    console.warn('[telemetry] status retry event dropped', error)
  }
}

/** Whether a failed or aborted fetch was the request timeout, the caller, or the network. */
export function abortEnd(signal: AbortSignal | undefined): StatusRetryEnd {
  if (!signal?.aborted) return 'network'
  const reason: unknown = signal.reason
  return reason instanceof DOMException && reason.name === 'TimeoutError'
    ? 'timeout'
    : 'cancelled'
}
