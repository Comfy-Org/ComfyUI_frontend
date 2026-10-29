import { useTelemetry } from '@comfyorg/telemetry'
import type {
  FetchStatusRetryMetadata,
  FetchStatusRetryOutcome
} from '@comfyorg/telemetry/types'

import { getFetchRouteTemplate } from '@/utils/fetchRouteTemplate'
import type { RetryStopReason } from '@/utils/retryPolicy'

/**
 * How one request's retry loop ended, as the transport saw it:
 * `answered` returned or rejected with a status the loop does not retry,
 * `attempts_spent` and `retry_after_too_long` stopped on a retryable status,
 * `timeout` ran out of the request's time, `network` had no response, and
 * `cancelled` was the caller's own abort.
 */
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

/**
 * What to record for a settled request, or `undefined` when there is nothing
 * to record: no retryable status was seen, the read opted out of retrying, or
 * the caller cancelled.
 */
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
      return finalStatus !== undefined && finalStatus < 400
        ? 'recovered'
        : 'failed'
  }
}

/** Maps a stop on an answer to how the loop ended. */
export function endForStop(reason: RetryStopReason): StatusRetryEnd {
  return reason === 'not_retryable' ? 'answered' : reason
}

/** Per page load, per host, route and outcome, so an outage cannot flood RUM. */
const MAX_EVENTS_PER_KEY = 20
const sentPerKey = new Map<string, number>()

function describeUrl(
  url: string
): Pick<FetchStatusRetryMetadata, 'host' | 'route'> {
  const parsed = new URL(url, location.href)
  return { host: parsed.host, route: getFetchRouteTemplate(parsed.pathname) }
}

interface StatusRetryReport extends StatusRetrySettlement {
  readonly transport: FetchStatusRetryMetadata['transport']
  readonly method: string
  /** Read only when there is something to record. */
  readonly url: () => string
}

/** Records one settled request that hit a retryable status. Never throws. */
export function trackStatusRetry(report: StatusRetryReport): void {
  try {
    const outcome = classifyStatusRetry(report)
    if (!outcome) return
    const { host, route } = describeUrl(report.url())
    const key = `${host} ${route} ${outcome}`
    const sent = sentPerKey.get(key) ?? 0
    if (sent >= MAX_EVENTS_PER_KEY) return
    sentPerKey.set(key, sent + 1)

    useTelemetry()?.trackFetchStatusRetry({
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
  } catch {
    // Telemetry must never change how a request ends.
  }
}

/** Whether an aborted request was the request timeout or the caller. */
export function abortEnd(signal: AbortSignal | undefined): StatusRetryEnd {
  if (!signal?.aborted) return 'network'
  const reason: unknown = signal.reason
  return reason instanceof DOMException && reason.name === 'TimeoutError'
    ? 'timeout'
    : 'cancelled'
}
