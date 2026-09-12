import type { NodePricingFailure } from '@comfyorg/shared-frontend-utils/nodePricingFailure'

import { reportError } from './reportError'

const MAX_REPORTS_PER_SESSION = 20
const REPORTABLE_OCCURRENCE_COUNTS = new Set([1, 10, 100, 1000])

const occurrenceCounts = new Map<string, number>()

const ERROR_TYPE_BY_OPERATION = {
  compile: 'nodes_pricing_rule_compile_failed',
  evaluate: 'nodes_pricing_rule_evaluate_failed',
  format: 'nodes_pricing_label_format_failed'
} as const

interface JsonataError {
  code: string
  message: string
  position?: number
  token?: string
}

/**
 * JSONata rejects with a plain object carrying a `stack` string, which
 * `toError` would serialise whole — absolute module paths and all — into the
 * Sentry issue title. Rebuild it as a real Error so the code and message drive
 * grouping.
 */
const isJsonataError = (cause: unknown): cause is JsonataError =>
  typeof cause === 'object' &&
  cause !== null &&
  'code' in cause &&
  typeof cause.code === 'string' &&
  'message' in cause &&
  typeof cause.message === 'string'

/**
 * Send a pricing rule failure to diagnostic error reporting.
 *
 * Rules are evaluated from a render-driven path — one scheduled evaluation per
 * widget signature — so a rule that always throws would otherwise emit a remote
 * report per dragged value. Only coarse recurrence thresholds are reported per
 * rule, and the number of distinct rules is capped per session.
 */
export function reportNodePricingFailure({
  operation,
  nodeType,
  source,
  expr,
  cause
}: NodePricingFailure): void {
  const key = `${operation}|${source}|${nodeType}`
  const previousCount = occurrenceCounts.get(key)
  if (
    previousCount === undefined &&
    occurrenceCounts.size >= MAX_REPORTS_PER_SESSION
  ) {
    return
  }

  const occurrenceCount = (previousCount ?? 0) + 1
  occurrenceCounts.set(key, occurrenceCount)
  if (!REPORTABLE_OCCURRENCE_COUNTS.has(occurrenceCount)) return

  const jsonataError = isJsonataError(cause) ? cause : undefined

  reportError(
    jsonataError
      ? new Error(`${jsonataError.code}: ${jsonataError.message}`, { cause })
      : cause,
    {
      errorType: ERROR_TYPE_BY_OPERATION[operation],
      tags: {
        failure_kind: 'degraded',
        feature_area: 'nodes',
        operation: 'render',
        outcome: 'recovered',
        assert_mode: 'soft',
        pricing_operation: operation,
        evaluation_source: source,
        node_type: nodeType,
        jsonata_code: jsonataError?.code
      },
      context: {
        expr,
        occurrenceCount,
        jsonataPosition: jsonataError?.position,
        jsonataToken: jsonataError?.token
      },
      level: 'warning'
    }
  )
}
