import { useTelemetry } from '@/platform/telemetry'
import type {
  ClientErrorReportedMetadata,
  ErrorFailureKind,
  ReportedErrorLevel
} from '@/platform/telemetry/types'
import { ERROR_FAILURE_KINDS } from '@/platform/telemetry/types'

/**
 * The failure modes whose *count* reaches product analytics.
 *
 * This set is the whole privacy surface of `app:client_error_reported`: nothing
 * outside it is counted, and nothing about an error other than the fields in
 * {@link ClientErrorReportedMetadata} is sent for the ones inside it. Adding a
 * slug here is a deliberate decision with two costs — read both before you do.
 *
 * **Volume.** In 2026-09-23→26, `reportError()` produced ~690,000 events across
 * 44 slugs; two slugs were 87% of them and one contributed 378,000 events from
 * 13 people. A counter a single looping client can move by five orders of
 * magnitude is not a funnel instrument, which is why this is an allowlist and
 * not a default-on sink.
 *
 * **Readability.** Each slug added here is a new denominator someone has to
 * know how to read. Prefer the smallest set that answers a question.
 *
 * See `docs/adr/TELEMETRY-ERRORS-0038-sanitised-error-counter-for-funnel-denominators.md`
 * for why this exists beside ADR-TELEMETRY-ROUTING-0013, which routes errors to
 * Datadog. This is not an alerting path — it is a funnel denominator.
 *
 * The four entries below are the agent consent surface. They exist because
 * every event that describes how a consent offer ended is absent from the build
 * production serves, while these failures fire on `cloud.comfy.org` today — so
 * on production the error channel is the only instrument this surface has, and
 * until now it did not reach product analytics at all.
 */
const COUNTED_ERROR_TYPES: ReadonlySet<string> = new Set([
  /** `useAgentConsent.requestConsentForCurrentUser` and `agentPanel.ts`'s
   * `loadConsentIfEligible` — the scope probe and the consent read. */
  'agent_consent_setting_load_failure',
  /** The consent write raised; the card stays open and retryable. */
  'agent_consent_setting_write_failure',
  /** The automatic offer raised before it could reach the card. */
  'agent_consent_auto_offer_failure',
  /** The signed-out flow's sign-in step raised. */
  'agent_consent_sign_in_failure'
])

/**
 * Per page load, per slug. A bound, not a measurement choice: it keeps one
 * client stuck in a retry loop from redefining a funnel denominator, the way
 * `graph_serialization_state_mismatch` did in Sentry. No counted slug has come
 * close to it — the busiest reached 5 reports per person across three days —
 * so it is not binding on anything measured today, and any count that hits it
 * is a floor.
 */
export const MAX_COUNTED_PER_ERROR_TYPE = 10

const countedSoFar = new Map<string, number>()

const FAILURE_KINDS: ReadonlySet<string> = new Set(ERROR_FAILURE_KINDS)

const isFailureKind = (value: unknown): value is ErrorFailureKind =>
  typeof value === 'string' && FAILURE_KINDS.has(value)

/**
 * Constructor names that identify a failure on their own. Names, not messages:
 * a class name is a source literal and cannot carry user data.
 */
const KIND_BY_ERROR_NAME: Readonly<Record<string, ErrorFailureKind>> = {
  AgentConsentAuthenticationError: 'auth_missing',
  SyntaxError: 'malformed_response',
  ZodError: 'malformed_response',
  TimeoutError: 'timeout',
  AbortError: 'timeout'
}

/**
 * What each engine's `fetch` throws when the request produced no response:
 * Chromium, Firefox, Safari, and React Native's polyfill in that order. Fixed
 * strings the browser owns, matched to *discard* the message rather than to
 * forward it — a wording change costs us `unclassified`, never a leak.
 */
const NETWORK_FAILURE_MESSAGES = [
  'failed to fetch',
  'networkerror when attempting to fetch resource.',
  'load failed',
  'network request failed'
]

/** A kind the thrower declared on the error, rather than one inferred from it. */
const declaredKindOf = (error: unknown): ErrorFailureKind | undefined => {
  const declared = (error as { failureKind?: unknown } | null)?.failureKind
  return isFailureKind(declared) ? declared : undefined
}

/**
 * An HTTP status the error carried, when it is an integer in the range the
 * protocol defines. A three-digit status code cannot identify a person, a
 * workspace, a URL or a prompt; it is the only field that separates "this user
 * has no consent stored yet" from "this user's session was rejected".
 */
export function httpStatusOf(error: unknown): number | undefined {
  const candidate = error as { status?: unknown; statusCode?: unknown } | null
  const status = candidate?.status ?? candidate?.statusCode
  if (typeof status !== 'number' || !Number.isInteger(status)) return
  return status >= 100 && status <= 599 ? status : undefined
}

function kindFromStatus(status: number): ErrorFailureKind {
  if (status === 401 || status === 403) return 'auth_rejected'
  if (status === 408 || status === 504) return 'timeout'
  if (status >= 500) return 'server_error'
  if (status >= 400) return 'request_rejected'
  return 'unclassified'
}

/**
 * Reduce an error to one value from a closed set, using structured fields only.
 *
 * Precedence is deliberate. A thrower that declared its own kind knows more
 * than any inference; a parse failure stays `malformed_response` even when the
 * response that could not be parsed also carried a status, because *which*
 * status it was is reported separately and the interesting fact is that the
 * body was unreadable.
 */
export function classifyFailureKind(error: unknown): ErrorFailureKind {
  const declared = declaredKindOf(error)
  if (declared) return declared

  const name = (error as { name?: unknown } | null)?.name
  if (typeof name === 'string' && name in KIND_BY_ERROR_NAME) {
    return KIND_BY_ERROR_NAME[name]
  }

  const message = (error as { message?: unknown } | null)?.message
  if (
    typeof message === 'string' &&
    NETWORK_FAILURE_MESSAGES.includes(message.trim().toLowerCase())
  ) {
    return 'network_unreachable'
  }

  const status = httpStatusOf(error)
  return status === undefined ? 'unclassified' : kindFromStatus(status)
}

/** The exact payload the counter would send, or `undefined` if it sends none. */
export function clientErrorReportedMetadata(
  error: unknown,
  errorType: string,
  level: ReportedErrorLevel = 'error'
): ClientErrorReportedMetadata | undefined {
  if (!COUNTED_ERROR_TYPES.has(errorType)) return

  const seen = countedSoFar.get(errorType) ?? 0
  if (seen >= MAX_COUNTED_PER_ERROR_TYPE) return
  countedSoFar.set(errorType, seen + 1)

  const status = httpStatusOf(error)
  return {
    error_type: errorType,
    failure_kind: classifyFailureKind(error),
    level,
    ...(status === undefined ? {} : { http_status: status })
  }
}

/**
 * Count an allowlisted failure in product analytics, having already reported it
 * to the error consoles.
 *
 * Never throws and never blocks: `reportError()` promises not to become a
 * second failure, and a telemetry registry that is not up yet simply means no
 * counter — the report itself is unaffected.
 */
export function trackReportedError(
  error: unknown,
  errorType: string,
  level: ReportedErrorLevel = 'error'
): void {
  try {
    const metadata = clientErrorReportedMetadata(error, errorType, level)
    if (!metadata) return
    useTelemetry()?.trackClientErrorReported(metadata)
  } catch (counterFailure) {
    console.error('[reportError] analytics counter failed', counterFailure)
  }
}

/** Test seam: the cap is per page load, and a test is not one. */
export function resetReportedErrorCounts(): void {
  countedSoFar.clear()
}
