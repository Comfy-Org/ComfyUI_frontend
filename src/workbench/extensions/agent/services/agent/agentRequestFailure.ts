/**
 * Route templates a failed agent request can be attributed to.
 *
 * Every id-bearing segment is a placeholder, so these literals are the only
 * forms that can ever reach a sink. That is the privacy property, and it holds
 * by construction rather than by scrubbing: `#19740` removed routes and ids
 * from `AgentResponseUnreadableError`'s message for exactly this reason
 * (PM-1903), and a template keeps the diagnostic value without reintroducing
 * the leak.
 *
 * `/other` mirrors `getFetchRouteTemplate` in `src/scripts/api.ts`: an
 * allowlist with a closed fallback, never a regex over whatever the caller
 * happened to request.
 */
export const AGENT_REQUEST_PATHS = [
  '/agent/threads',
  '/agent/threads/{threadId}/messages',
  '/agent/threads/{threadId}/messages/{messageId}/cancel',
  '/agent/threads/{threadId}/asks/{askId}/answer',
  '/agent/run-mode',
  '/workflows',
  '/upload/image',
  '/other'
] as const

export type AgentRequestPath = (typeof AGENT_REQUEST_PATHS)[number]

/**
 * Literal segment sequences, each paired with the template it reports.
 *
 * Matched positionally against the request's own segments, with `null` standing
 * for "any single segment, not recorded". A route that matches nothing is
 * `/other` — a new endpoint loses its label rather than leaking a raw path.
 */
const ROUTE_PATTERNS: ReadonlyArray<{
  segments: ReadonlyArray<string | null>
  path: AgentRequestPath
}> = [
  { segments: ['agent', 'threads'], path: '/agent/threads' },
  {
    segments: ['agent', 'threads', null, 'messages'],
    path: '/agent/threads/{threadId}/messages'
  },
  {
    segments: ['agent', 'threads', null, 'messages', null, 'cancel'],
    path: '/agent/threads/{threadId}/messages/{messageId}/cancel'
  },
  {
    segments: ['agent', 'threads', null, 'asks', null, 'answer'],
    path: '/agent/threads/{threadId}/asks/{askId}/answer'
  },
  { segments: ['agent', 'run-mode'], path: '/agent/run-mode' },
  { segments: ['workflows'], path: '/workflows' },
  { segments: ['upload', 'image'], path: '/upload/image' }
]

/** The route template a request path reports as, or `/other`. */
export function agentRequestPath(route: string): AgentRequestPath {
  const segments = (route.split(/[?#]/)[0] ?? '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent)
  const match = ROUTE_PATTERNS.find(
    (pattern) =>
      pattern.segments.length === segments.length &&
      pattern.segments.every(
        (expected, index) => expected === null || expected === segments[index]
      )
  )
  return match?.path ?? '/other'
}

/**
 * The failure's identity, reduced to a closed set.
 *
 * An error's `name` is settable, so this allowlist — not the name itself — is
 * what reaches a sink. That keeps tag cardinality bounded and guarantees no
 * message or body text rides along under a renamed error. Everything the agent
 * REST boundary can raise is named:
 *
 * - `AgentApiError` — the server answered non-2xx; `request_status` is set.
 * - `AgentResponseUnreadableError` — 2xx with a body that is not JSON.
 * - `ZodError` — 2xx, valid JSON, wrong shape.
 * - `TimeoutError` / `AbortError` — `DOMException`s from `fetchApi`'s header
 *   deadline and from caller cancellation respectively.
 * - `TypeError` — the request never reached the server ("Failed to fetch").
 */
export const AGENT_REQUEST_ERROR_NAMES = [
  'AgentApiError',
  'AgentResponseUnreadableError',
  'ZodError',
  'TimeoutError',
  'AbortError',
  'TypeError',
  'other'
] as const

type AgentRequestErrorName = (typeof AGENT_REQUEST_ERROR_NAMES)[number]

const KNOWN_ERROR_NAMES: ReadonlySet<string> = new Set(
  AGENT_REQUEST_ERROR_NAMES
)

/**
 * Privacy-safe diagnosis of a failed agent request.
 *
 * Every field is drawn from a closed set or is an HTTP status, so the whole
 * record is safe on a telemetry event and on a Sentry tag. There is no field
 * for a message, a body, a thread id, a workflow id, or a user.
 */
export interface AgentRequestFailureDiagnostics extends Record<
  string,
  string | number | undefined
> {
  /**
   * Absent when the failure did not come from an agent REST request at all —
   * which is itself the signal, since several callers wrap more than one
   * request in a single `catch`. Never guessed from the call site.
   */
  request_path?: AgentRequestPath
  /** Absent when the request never produced a response. */
  request_status?: number
  request_error: AgentRequestErrorName
}

/**
 * The route each in-flight failure came from.
 *
 * A side channel rather than a field on the error, because the thrown value has
 * to keep its exact identity: `#19740` landed specifically to stop transport
 * failures being renamed, and `isRetryableRequestFailure` and
 * `handleHistoryLoadError` both branch on `instanceof` and on `status`.
 * Keyed weakly, so remembering a route never keeps an error alive.
 */
const failureRoutes = new WeakMap<object, AgentRequestPath>()

/**
 * Records which request a failure came from, and returns it unchanged.
 *
 * Called at the REST boundary, which is the only place that knows the answer. A
 * call site cannot supply it: `hydrateFromServer` wraps `getMessages`,
 * `conversationStore.hydrate` and `workflow.restored` in one `try`, so a path
 * asserted there would label a `/workflows` or `/agent/run-mode` failure as a
 * history load — production already shows `/agent/run-mode` reported under
 * `agent_history_load_failed`, and a confidently wrong endpoint is worse than
 * none.
 *
 * A thrown primitive is skipped: it cannot key a `WeakMap`, and it also cannot
 * come from `request()`.
 */
export function rememberAgentRequestFailure<E>(error: E, route: string): E {
  if (typeof error === 'object' && error !== null) {
    failureRoutes.set(error, agentRequestPath(route))
  }
  return error
}

/**
 * Read off `name` rather than `instanceof`, so this module imports nothing
 * from `agentRestClient` and `request()` can import it back without a cycle.
 * Each class the boundary raises sets its own `name`, and `other` for anything
 * not on the allowlist is what makes the read safe.
 */
function errorNameOf(error: unknown): AgentRequestErrorName {
  if (!(error instanceof Error)) return 'other'
  return KNOWN_ERROR_NAMES.has(error.name)
    ? (error.name as AgentRequestErrorName)
    : 'other'
}

/**
 * Only an `AgentApiError` carries a status, and only a numeric one is reported:
 * nothing else in the boundary's vocabulary saw a response at all, so inferring
 * a status for them would invent data.
 */
function statusOf(
  error: unknown,
  name: AgentRequestErrorName
): number | undefined {
  if (name !== 'AgentApiError') return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

/**
 * Describes a failed agent request for the error sinks.
 *
 * FE-3200: `app:agent_error` carried only `error_class`, `failure_stage`,
 * `ui_treatment`, `retryable` and `turn_accepted`, so a thread-list or history
 * load failure was a count and nothing more — 213 distinct users over 3.3 days
 * with no recorded cause anywhere. These three fields separate "the agent panel
 * failed to load" from "the panel got a 401 on `/agent/threads`", and
 * `request_error` is what explains the near-even retryable split:
 * `isRetryableRequestFailure` decides from the error's class and its status,
 * both of which were discarded before anything was recorded.
 */
export function describeAgentRequestFailure(
  error: unknown
): AgentRequestFailureDiagnostics {
  const path =
    typeof error === 'object' && error !== null
      ? failureRoutes.get(error)
      : undefined
  const name = errorNameOf(error)
  const status = statusOf(error, name)
  return {
    ...(path ? { request_path: path } : undefined),
    ...(status !== undefined ? { request_status: status } : undefined),
    request_error: name
  }
}

/**
 * Groups the report into its own Sentry issue.
 *
 * Without this these reports reach Sentry and are then invisible:
 * `CLOUD-FRONTEND-PROD-1` is a merged issue carrying 49 distinct `error_type`
 * values and ~18M events, and 168 of the 173 `agent_thread_list_load_failed`
 * reports in a 14-day window landed in it. A report nobody can find is not a
 * report, which is why FE-3200 was opened believing none was sent at all.
 *
 * Deliberately excludes `request_status`, so one issue covers one failure mode
 * with the status as a tag facet inside it. Splitting per status would scatter
 * one problem across a dozen issues and make it un-alertable again.
 */
export function agentRequestFailureFingerprint(
  errorType: string,
  diagnostics: AgentRequestFailureDiagnostics
): string[] {
  return [
    'agent-request-failure',
    errorType,
    diagnostics.request_path ?? 'unattributed',
    diagnostics.request_error
  ]
}
