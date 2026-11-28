import type {
  AgentAnswerRequest,
  AgentUsageStatusResponse,
  AgentPostMessageRequest,
  PaginationInfo,
  UploadImageResponse,
  WorkflowResponse
} from '@comfyorg/ingest-types'
import {
  zAgentGetDraftResponse,
  zAgentUsageStatusResponse,
  zGetWorkflowContentResponse,
  zUploadImageResponse,
  zWorkflowSidebarFileResponse,
  zWorkflowResponse
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import type {
  AuthRejectionStatus,
  AuthRejectionTags
} from '@/platform/auth/authRejection'
import {
  authRejectionTags,
  isAuthRejectionStatus
} from '@/platform/auth/authRejection'
import { markErrorReported, reportError } from '@comfyorg/telemetry/reportError'
import { api } from '@/scripts/api'
import type { AuthCredential, AuthScheme } from '@comfyorg/api-client/authTypes'

import { refusedAttachmentsMessage } from '@/workbench/extensions/agent/utils/attachmentMessages'
import { withAgentAuth } from './agentAuth'
import { takePendingPreviousCredential } from './agentOwnerHandoff'

import {
  agentRequestFailureFingerprint,
  describeAgentRequestFailure,
  rememberAgentRequestFailure
} from './agentRequestFailure'
import type { AgentRequestFailureDiagnostics } from './agentRequestFailure'
import {
  RENDERED_ASK_KINDS,
  zAgentAnswerReceipt,
  zAgentCancelAccepted,
  zAgentError,
  zAgentIdentity,
  zAgentMessages,
  zAgentRunMode,
  zAgentThreads,
  zAgentTurnAccepted,
  zAttachmentRejection,
  zCloudWorkflowIndex,
  zCredentialNotOwnerError,
  zLoopbackOnlyRefusal
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type {
  AgentAnswerReceipt,
  AgentCancelAccepted,
  AgentMessages,
  AgentRunModePreference,
  AgentThreadSummary,
  AgentTurnAccepted,
  CloudWorkflowEntry
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

const LIST_PAGE_SIZE = 100
const POST_MESSAGE_TIMEOUT_MS = 60_000

/**
 * PM-1658: tightens `fetchApi`'s shared 60s header deadline for the one
 * request an ask card's Submit waits on, since the card is held disabled
 * from the click until this settles. A quarter of it, rather than merely lower, so that
 * the caller's single re-drive still fits inside the 60s the card used to be
 * able to wait. Goes through `timeoutMs` rather than a raw signal so a timeout
 * still raises fetchApi's own telemetry.
 */
const ANSWER_ASK_TIMEOUT_MS = 15_000

/**
 * The agent client's operation vocabulary, used as the telemetry identity of a
 * failing call (PM-1802).
 *
 * This is deliberately a closed union chosen at the call site rather than
 * anything derived from the request path. Agent routes embed thread, message
 * and ask ids, and `/workflows` carries a pagination cursor, so a path-derived
 * tag would both leak user-scoped identifiers into Sentry/Datadog and have
 * unbounded cardinality. Normalizing a path back down is a regex that can be
 * got wrong later; naming the operation cannot, because adding a call site
 * without extending this union is a type error. One name per
 * method-and-endpoint pair, so the method never has to be a second tag.
 *
 * Deliberately not exported: every call site is in this file, and the dead-code
 * audit gate rejects a type export with no consumers.
 */
type AgentApiOperation =
  | 'answer_thread_ask'
  | 'cancel_thread_message'
  | 'delete_thread'
  | 'get_agent_identity'
  | 'get_usage_status'
  | 'get_cloud_workflow'
  | 'get_workflow_content'
  | 'get_workflow_draft'
  | 'get_workflow_sidebar_file'
  | 'get_run_mode'
  | 'get_thread_messages'
  | 'hand_off_owner'
  | 'list_cloud_workflows'
  | 'list_threads'
  | 'post_thread_message'
  | 'put_run_mode'
  | 'refresh_credential'
  | 'upload_image'

type ReportedAuthScheme = AuthScheme | 'unreported'
type ReportedAuthCredential = AuthCredential | 'unreported'

/**
 * The reported message for an auth rejection, constant by construction.
 *
 * The backend's own text is what `AgentApiError` carries to the caller, but it
 * is not the Sentry message: it is uncontrolled and varies enough to fragment
 * issue grouping across what is one failure mode. Status, operation, auth
 * scheme, credential kind and an allowlisted classification of the backend's
 * refusal ride as tags.
 */
const AUTH_REJECTED_MESSAGE = 'Agent API request rejected by authentication'

interface AuthRejection {
  status: AuthRejectionStatus
  operation: AgentApiOperation
  authScheme: ReportedAuthScheme
  credential: ReportedAuthCredential
  body: unknown
  message: string
  diagnostics: AgentRequestFailureDiagnostics
}

function reportAuthRejection({
  status,
  operation,
  authScheme,
  credential,
  body,
  message,
  diagnostics
}: AuthRejection): boolean {
  let backendTags: AuthRejectionTags
  try {
    backendTags = authRejectionTags(body, message)
  } catch {
    backendTags = {}
  }
  try {
    reportError(new Error(AUTH_REJECTED_MESSAGE), {
      surface: 'agent',
      errorType: 'agent_api_auth_rejected',
      tags: {
        operation,
        status,
        authScheme,
        credential,
        ...backendTags,
        ...diagnostics
      },
      fingerprint: agentRequestFailureFingerprint(
        'agent_api_auth_rejected',
        diagnostics
      ),
      level: 'warning'
    })
    return true
  } catch {
    return false
  }
}

export class AgentApiError extends Error {
  readonly status: number
  readonly body: unknown
  readonly retryAfterSeconds?: number
  /** The {@link AgentApiOperation} that raised this error. */
  readonly operation?: string

  constructor(
    message: string,
    status: number,
    body: unknown,
    retryAfterSeconds?: number,
    operation?: string
  ) {
    super(
      message.trim().length > 0
        ? message
        : `Agent request failed (HTTP ${status})`
    )
    this.name = 'AgentApiError'
    this.status = status
    this.body = body
    this.retryAfterSeconds = retryAfterSeconds
    this.operation = operation
  }
}

export function isLoopbackOnlyRefusal(error: unknown): error is AgentApiError {
  return (
    error instanceof AgentApiError &&
    error.status === 403 &&
    zLoopbackOnlyRefusal.safeParse(error.body).success
  )
}

export function isCredentialNotOwnerRefusal(
  error: unknown
): error is AgentApiError {
  return (
    error instanceof AgentApiError &&
    error.status === 403 &&
    zCredentialNotOwnerError.safeParse(error.body).success
  )
}

/**
 * The handoff this request attempted (`POST /agent/owner`, triggered by a
 * `credential_not_owner` refusal) was itself refused. The previous account's
 * credential is no longer one Cloud accepts - e.g. a page reload lost it, or
 * a Firebase token aged out - so no retry can recover the original request;
 * `services/agent/ARCHITECTURE.md`'s owner-binding section names a ComfyUI
 * restart as the only remaining route (BE-25360).
 */
export class AgentOwnerHandoffFailedError extends Error {
  constructor(cause: unknown) {
    super('Agent ownership handoff was refused; restart ComfyUI to continue', {
      cause
    })
    this.name = 'AgentOwnerHandoffFailedError'
  }
}

export class AgentResponseUnreadableError extends Error {
  constructor(cause: unknown) {
    super('Unreadable agent response body', { cause })
    this.name = 'AgentResponseUnreadableError'
  }
}

type PaginationStopReason =
  | 'missing_cursor'
  | 'repeated_cursor'
  | 'request_failed'

type RequestResult<T> = { ok: true; value: T } | { ok: false; cause: unknown }

function paginationFailure<Item>(
  failure: Extract<RequestResult<never>, { ok: false }>,
  items: Item[],
  retainItems: boolean
): RequestResult<{ items: Item[]; stopReason?: PaginationStopReason }> {
  return retainItems && items.length > 0
    ? { ok: true, value: { items, stopReason: 'request_failed' } }
    : failure
}

export type ThreadListing =
  | { status: 'complete'; threads: AgentThreadSummary[] }
  /** Paging stopped early; carries the distinct threads it did reach. */
  | {
      status: 'incomplete'
      reason: PaginationStopReason
      threads: AgentThreadSummary[]
    }
  | { status: 'failed'; cause: unknown }
  | { status: 'aborted' }

/** One cloud workflow row, as `GET /api/workflows/{id}` returns it. */
export type CloudWorkflowRecord = WorkflowResponse

/** A workflow index and whether pagination reached its last page. */
export interface CloudWorkflowListing {
  entries: CloudWorkflowEntry[]
  complete: boolean
}

export type OpenTabsSnapshot = Pick<
  AgentPostMessageRequest,
  'open_tabs' | 'current_tab'
>

/**
 * The client's live canvas, sent so the agent works on what the user sees.
 *
 * Content-only, and deliberately asymmetric with the `GET /api/agent/draft`
 * snapshot, which still returns a version: `workflow_draft.version` is a
 * projection-cache snapshot counter, not a concurrency token, so there is
 * nothing on the request side for a version to reconcile against. The turn
 * endpoint's schema has no such field.
 */
export type DraftSnapshot = Required<
  NonNullable<AgentPostMessageRequest['draft']>
>

export interface PostMessageInput {
  content: string
  workflowId?: string
  selection?: Record<string, unknown>
  /** Plain canvas selection, sent apart from the tagged `selection`. */
  canvasSelection?: Record<string, unknown>
  attachments?: string[]
  workflowReferences?: AgentPostMessageRequest['workflow_references']
  tabs?: OpenTabsSnapshot
  draft?: DraftSnapshot
  /**
   * The turn's target tab has no cloud id yet (a fresh, unsaved tab) - see
   * AgentPostMessageRequest['current_tab_unbound']. Tells the server this is
   * a selected-but-unbound tab rather than no tab at all, so it mints a
   * workflow for it instead of falling back to the thread's previous one and
   * presenting the turn to the model as having no workflow selected.
   */
  currentTabUnbound?: boolean
  /**
   * The uuid this send already reports on its own `app:agent_message_sent`
   * event. Sent so the server can echo it onto `agent_turn_started`, which is
   * the only way to tell which message started which turn - `turn_id` is minted
   * server-side after the request arrives, so it cannot be on the client event.
   * Optional: when absent the correlation is unknown for that turn, which is a
   * gap in the funnel read, never a failed send.
   */
  clientMessageId?: string
}

const CLIENT_VERSION = `${__COMFYUI_FRONTEND_VERSION__}+${__COMFYUI_FRONTEND_COMMIT__}`

type PostMessageBody = AgentPostMessageRequest & {
  canvas_selection?: Record<string, unknown>
}

/**
 * Drops keys whose value is `undefined` so an absent optional is omitted from the
 * JSON body rather than sent as an explicit null-ish key. `false` and `0` are
 * values and survive - `current_tab_unbound: false` is a meaningful signal, so
 * this filters on `undefined` exactly, never on falsiness.
 */
function withoutUndefined<T extends object>(fields: T): T {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  ) as T
}

interface IngestErrorBody {
  error: { message: string }
}

function isIngestErrorBody(body: unknown): body is IngestErrorBody {
  if (typeof body !== 'object' || body === null) return false
  const { error } = body as { error?: unknown }
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

function parseErrorBody(text: string): unknown {
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function getBackendErrorMessage(body: unknown): string | undefined {
  const plain = zAgentError.safeParse(body)
  if (plain.success) {
    return typeof plain.data.error === 'string'
      ? plain.data.error
      : plain.data.error.message
  }
  return isIngestErrorBody(body) ? body.error.message : undefined
}

function getErrorMessage(
  body: unknown,
  status: number,
  operation: AgentApiOperation,
  statusText: string
): string {
  const refused = zAttachmentRejection.safeParse(body)
  if (refused.success) {
    return refusedAttachmentsMessage(
      refused.data.rejected,
      refused.data.rejected_count
    )
  }

  const backendMessage = getBackendErrorMessage(body)
  const normalizedStatusText = statusText.trim().slice(0, 80)
  const statusTextSuffix =
    !normalizedStatusText ||
    normalizedStatusText.toLowerCase() === 'no error message'
      ? ''
      : ` ${normalizedStatusText}`
  return backendMessage?.trim()
    ? backendMessage
    : `Agent request failed (HTTP ${status}${statusTextSuffix}, ${operation})`
}

const DAY_NAME = 'Mon|Tue|Wed|Thu|Fri|Sat|Sun'
const DAY_NAME_LONG = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday'
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]
const MONTH = MONTHS.join('|')
const TIME_OF_DAY = '(\\d{2}):(\\d{2}):(\\d{2})'

const IMF_FIXDATE = new RegExp(
  `^(?:${DAY_NAME}), (\\d{2}) (${MONTH}) (\\d{4}) ${TIME_OF_DAY} GMT$`
)
const RFC850_DATE = new RegExp(
  `^(?:${DAY_NAME_LONG}), (\\d{2})-(${MONTH})-(\\d{2}) ${TIME_OF_DAY} GMT$`
)
const ASCTIME_DATE = new RegExp(
  `^(?:${DAY_NAME}) (${MONTH}) (\\d{2}| \\d) ${TIME_OF_DAY} (\\d{4})$`
)

interface HttpDateFields {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function monthNumber(name: string): number {
  return MONTHS.indexOf(name) + 1
}

function httpDateInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): number {
  const ordinaryInstant = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    Math.min(second, 59)
  )
  return ordinaryInstant + (second === 60 ? 1000 : 0)
}

function hasValidHttpDateFields(fields: HttpDateFields): boolean {
  const { year, hour, minute, second } = fields
  return year >= 1900 && hour <= 23 && minute <= 59 && second <= 60
}

function namesRealCalendarDate(
  fields: HttpDateFields,
  instant: number
): boolean {
  const { year, month, day, second } = fields
  // Subtract the represented leap second before validating the source date so
  // `23:59:60` rolling into the next day remains valid.
  const utc = new Date(instant - (second === 60 ? 1000 : 0))
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  )
}

/**
 * The four-digit year an RFC 850 two-digit year stands for. RFC 9110 requires a
 * timestamp that would read as more than 50 years in the future to be taken as
 * the most recent past year with those last two digits, which is a rolling
 * window rather than the fixed pivot `Date.parse` applies.
 */
function expandTwoDigitYear(
  twoDigit: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): number {
  const now = new Date(Date.now())
  const candidateYear = Math.floor(now.getUTCFullYear() / 100) * 100 + twoDigit
  const fiftyYearsFromNow = Date.UTC(
    now.getUTCFullYear() + 50,
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
    now.getUTCMilliseconds()
  )
  for (const year of [candidateYear + 100, candidateYear]) {
    const candidate = httpDateInstant(year, month, day, hour, minute, second)
    if (candidate <= fiftyYearsFromNow) return year
  }
  return candidateYear - 100
}

function httpDateFields(value: string): HttpDateFields | undefined {
  const imf = IMF_FIXDATE.exec(value)
  if (imf)
    return {
      year: Number(imf[3]),
      month: monthNumber(imf[2]),
      day: Number(imf[1]),
      hour: Number(imf[4]),
      minute: Number(imf[5]),
      second: Number(imf[6])
    }

  const rfc850 = RFC850_DATE.exec(value)
  if (rfc850) {
    const month = monthNumber(rfc850[2])
    const day = Number(rfc850[1])
    const hour = Number(rfc850[4])
    const minute = Number(rfc850[5])
    const second = Number(rfc850[6])
    return {
      year: expandTwoDigitYear(
        Number(rfc850[3]),
        month,
        day,
        hour,
        minute,
        second
      ),
      month,
      day,
      hour,
      minute,
      second
    }
  }

  const asctime = ASCTIME_DATE.exec(value)
  if (asctime)
    return {
      year: Number(asctime[6]),
      month: monthNumber(asctime[1]),
      day: Number(asctime[2].trim()),
      hour: Number(asctime[3]),
      minute: Number(asctime[4]),
      second: Number(asctime[5])
    }

  return undefined
}

/**
 * The instant an RFC 9110 `HTTP-date` names, or `undefined` when the value is
 * not one of the three formats that grammar allows (IMF-fixdate, RFC 850,
 * asctime) or names no real date.
 *
 * The components are read and checked here rather than handed to `Date.parse`,
 * which accepts far more than the grammar - an ISO-8601 local timestamp such as
 * `2099-12-31T00:00:00` among them - and whose handling of these pre-ISO
 * formats is implementation-defined: V8 rolls `29 Feb 2023` forward to March 1,
 * reads `24:00:00` as the next day, and applies a fixed two-digit-year pivot
 * rather than the rolling one RFC 9110 mandates. Calendar and time fields are
 * validated, and all three formats name a UTC instant (asctime carries no zone
 * but is defined as UTC), so the result no longer varies with the engine or the
 * host zone.
 *
 * Deliberately lenient about `day-name`: RFC 9110 asks recipients to be robust,
 * so a weekday that disagrees with the date is ignored rather than rejected.
 */
function parseHttpDate(value: string): number | undefined {
  const fields = httpDateFields(value)
  if (fields === undefined) return undefined
  if (!hasValidHttpDateFields(fields)) return undefined
  const { year, month, day, hour, minute, second } = fields
  const instant = httpDateInstant(year, month, day, hour, minute, second)
  // `Date.UTC` rolls an impossible day into the next month (`31 Nov`, `29 Feb`
  // outside a leap year), so the round-trip is what proves the date exists.
  return namesRealCalendarDate(fields, instant) ? instant : undefined
}

function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) return undefined
  if (/^\d+$/.test(header)) return asDelaySeconds(Number(header))
  if (Number.isFinite(Number(header))) return undefined
  const deadline = parseHttpDate(header)
  if (deadline === undefined) return undefined
  return asDelaySeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
}

function asDelaySeconds(seconds: number): number | undefined {
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : undefined
}

function uniqueById(threads: AgentThreadSummary[]): AgentThreadSummary[] {
  const seen = new Set<string>()
  return threads.filter(({ id }) => {
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function getNextPageCursor(
  cursor: PaginationInfo['next_cursor'],
  seenCursors: ReadonlySet<string>
): { ok: true; cursor: string } | { ok: false; reason: PaginationStopReason } {
  if (!cursor) return { ok: false, reason: 'missing_cursor' }
  if (seenCursors.has(cursor)) return { ok: false, reason: 'repeated_cursor' }
  return { ok: true, cursor }
}

export function createAgentRestClient() {
  async function toApiError(
    response: Response,
    operation: AgentApiOperation,
    route: string,
    authScheme: ReportedAuthScheme,
    credential: ReportedAuthCredential
  ): Promise<AgentApiError> {
    const body = parseErrorBody(await response.text())
    const backendMessage = getBackendErrorMessage(body)
    const message = getErrorMessage(
      body,
      response.status,
      operation,
      response.statusText
    )
    const retryAfterSeconds = parseRetryAfter(
      response.headers.get('Retry-After')
    )
    // PM-1802: a prior auth-rejection alert (AgentApiError: authentication
    // method not allowed) arrived with no failing endpoint and no record of
    // which auth path was taken, so it couldn't be diagnosed. Reporting both
    // here means the next occurrence can be.
    const apiError = rememberAgentRequestFailure(
      new AgentApiError(
        message,
        response.status,
        body,
        retryAfterSeconds,
        operation
      ),
      route
    )
    if (
      !isLoopbackOnlyRefusal(apiError) &&
      !isCredentialNotOwnerRefusal(apiError) &&
      isAuthRejectionStatus(response.status) &&
      reportAuthRejection({
        status: response.status,
        operation,
        authScheme,
        credential,
        body,
        message: backendMessage ?? '',
        diagnostics: describeAgentRequestFailure(apiError)
      })
    ) {
      // Callers still receive the backend text for the UI, but their generic
      // catch boundaries must not emit it as a second, separately-grouped
      // report after the complete bounded diagnostic above.
      markErrorReported(apiError)
    }
    return apiError
  }

  /**
   * Retries `operation` once through a handoff to the new account, when the
   * refusal is `credential_not_owner` and a previous account's credential was
   * captured for this switch. Returns `undefined` when none of that applies,
   * so the caller falls through to `apiError` unchanged (BE-25360).
   */
  async function tryOwnerHandoffRetry(
    apiError: AgentApiError,
    operation: AgentApiOperation,
    route: string,
    init: Parameters<typeof api.fetchApi>[1]
  ): Promise<RequestResult<Response> | undefined> {
    if (
      operation === 'hand_off_owner' ||
      !isCredentialNotOwnerRefusal(apiError)
    )
      return undefined
    const previousCredential = takePendingPreviousCredential()
    if (previousCredential === null) return undefined
    const handoff = await requestResult(
      'hand_off_owner',
      '/agent/owner',
      jsonInit('POST', { previous_credential: previousCredential }),
      z.void(),
      { allowOwnerHandoff: false }
    )
    return handoff.ok
      ? fetchAuthorized(operation, route, init, false)
      : { ok: false, cause: new AgentOwnerHandoffFailedError(handoff.cause) }
  }

  /** The 204 the handoff route answers with on success never carries a JSON body. */
  function parseResponseBody<T>(
    response: Response,
    schema: z.ZodType<T>,
    treatBodyFailureAsUnreadable = false
  ): Promise<RequestResult<T>> {
    return response.status === 204
      ? Promise.resolve(parseAgainst(schema, undefined))
      : response
          .json()
          .then((payload: unknown) => parseAgainst(schema, payload))
          .catch((cause: unknown) => ({
            ok: false,
            cause:
              cause instanceof SyntaxError || treatBodyFailureAsUnreadable
                ? new AgentResponseUnreadableError(cause)
                : cause
          }))
  }

  function parseAgainst<T>(
    schema: z.ZodType<T>,
    payload: unknown
  ): RequestResult<T> {
    const parsed = schema.safeParse(payload)
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, cause: parsed.error }
  }

  async function fetchAuthorized(
    operation: AgentApiOperation,
    route: string,
    init: Parameters<typeof api.fetchApi>[1],
    /**
     * False only on the retried call after a successful handoff, and on the
     * handoff call itself - both must surface their own refusal rather than
     * recursing again (BE-25360).
     */
    allowOwnerHandoff = true
  ): Promise<RequestResult<Response>> {
    let authScheme: ReportedAuthScheme = 'unreported'
    let credential: ReportedAuthCredential = 'unreported'
    let response: Response
    try {
      response = await api.fetchApi(
        route,
        await withAgentAuth({
          ...init,
          onAuthScheme: (scheme) => {
            authScheme = scheme
          },
          onAuthCredential: (kind) => {
            credential = kind
          }
        })
      )
    } catch (cause) {
      return { ok: false, cause }
    }
    if (!response.ok) {
      let apiError: AgentApiError
      try {
        apiError = await toApiError(
          response,
          operation,
          route,
          authScheme,
          credential
        )
      } catch (cause) {
        return { ok: false, cause }
      }
      if (allowOwnerHandoff) {
        const retried = await tryOwnerHandoffRetry(
          apiError,
          operation,
          route,
          init
        )
        if (retried) return retried
      }
      return { ok: false, cause: apiError }
    }
    return { ok: true, value: response }
  }

  async function requestResult<T>(
    operation: AgentApiOperation,
    route: string,
    init: Parameters<typeof api.fetchApi>[1],
    schema: z.ZodType<T>,
    {
      allowOwnerHandoff = true,
      treatBodyFailureAsUnreadable = false
    }: {
      allowOwnerHandoff?: boolean
      treatBodyFailureAsUnreadable?: boolean
    } = {}
  ): Promise<RequestResult<T>> {
    const responseResult = await fetchAuthorized(
      operation,
      route,
      init,
      allowOwnerHandoff
    )
    if (!responseResult.ok) return responseResult
    return parseResponseBody(
      responseResult.value,
      schema,
      treatBodyFailureAsUnreadable
    )
  }

  async function requestEmpty(
    operation: AgentApiOperation,
    route: string,
    init: Parameters<typeof api.fetchApi>[1]
  ): Promise<void> {
    const responseResult = await fetchAuthorized(operation, route, init)
    if (!responseResult.ok)
      throw rememberAgentRequestFailure(responseResult.cause, route)
  }

  async function request<T>(
    operation: AgentApiOperation,
    route: string,
    init: Parameters<typeof api.fetchApi>[1],
    schema: z.ZodType<T>,
    treatBodyFailureAsUnreadable = false
  ): Promise<T> {
    const result = await requestResult(operation, route, init, schema, {
      treatBodyFailureAsUnreadable
    })
    if (!result.ok) throw rememberAgentRequestFailure(result.cause, route)
    return result.value
  }

  function jsonInit(method: string, body: unknown): RequestInit {
    return {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  }

  async function listAllPages<
    Page extends { pagination: PaginationInfo },
    Item
  >(
    operation: AgentApiOperation,
    path: string,
    schema: z.ZodType<Page>,
    itemsOf: (page: Page) => Item[],
    signal?: AbortSignal,
    retainItemsOnFailure = false
  ): Promise<
    RequestResult<{ items: Item[]; stopReason?: PaginationStopReason }>
  > {
    const items: Item[] = []
    let cursor: string | undefined
    let hasMore: boolean
    const seenCursors = new Set<string>()
    do {
      const after = cursor ? `&after=${encodeURIComponent(cursor)}` : ''
      const separator = path.includes('?') ? '&' : '?'
      const route = `${path}${separator}limit=${LIST_PAGE_SIZE}${after}`
      const result = await requestResult(
        operation,
        route,
        { method: 'GET', signal },
        schema
      )
      if (signal?.aborted) return { ok: false, cause: signal.reason }
      if (!result.ok)
        return paginationFailure(
          {
            ok: false,
            cause: rememberAgentRequestFailure(result.cause, route)
          },
          items,
          retainItemsOnFailure
        )
      const page = result.value
      items.push(...itemsOf(page))
      hasMore = page.pagination.has_more
      if (hasMore) {
        const next = getNextPageCursor(page.pagination.next_cursor, seenCursors)
        if (!next.ok)
          return { ok: true, value: { items, stopReason: next.reason } }
        seenCursors.add(next.cursor)
        cursor = next.cursor
      }
    } while (hasMore)
    return { ok: true, value: { items } }
  }

  async function postMessage(
    threadId: string,
    req: PostMessageInput
  ): Promise<AgentTurnAccepted> {
    const body = withoutUndefined<PostMessageBody>({
      content: req.content,
      ask_kinds: [...RENDERED_ASK_KINDS],
      workflow_id: req.workflowId,
      open_tabs: req.tabs?.open_tabs,
      current_tab: req.tabs?.current_tab,
      workflow_references: req.workflowReferences,
      selection: req.selection,
      canvas_selection: req.canvasSelection,
      attachments: req.attachments,
      draft: req.draft && { content: req.draft.content },
      current_tab_unbound: req.currentTabUnbound,
      client_message_id: req.clientMessageId,
      // Not `client_message_id`'s sibling: this is THIS TAB's ComfyUI socket
      // id, which local agent runs are submitted under so their execution
      // events reach this canvas (PM-1875). Read ambiently rather than taken
      // from `req` because it belongs to the socket, not to the message.
      client_id: api.clientId,
      client_version: CLIENT_VERSION
    })
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () =>
        controller.abort(
          new DOMException('Agent post message timeout', 'TimeoutError')
        ),
      POST_MESSAGE_TIMEOUT_MS
    )
    try {
      return await request(
        'post_thread_message',
        `/agent/threads/${encodeURIComponent(threadId)}/messages`,
        { ...jsonInit('POST', body), signal: controller.signal },
        zAgentTurnAccepted,
        true
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async function getUsageStatus(
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentUsageStatusResponse> {
    return request(
      'get_usage_status',
      '/agent/usage-status',
      {
        method: 'GET',
        signal: options.signal
      },
      zAgentUsageStatusResponse
    )
  }

  async function getMessages(
    threadId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentMessages> {
    return request(
      'get_thread_messages',
      `/agent/threads/${encodeURIComponent(threadId)}/messages`,
      { method: 'GET', signal: options.signal },
      zAgentMessages
    )
  }

  async function listThreads(
    options: {
      signal?: AbortSignal
      workflowId?: string
    } = {}
  ): Promise<ThreadListing> {
    if (options.signal?.aborted) return { status: 'aborted' }
    const workflowQuery =
      options.workflowId === undefined
        ? ''
        : `?workflow_id=${encodeURIComponent(options.workflowId)}`
    const result = await listAllPages(
      'list_threads',
      `/agent/threads${workflowQuery}`,
      zAgentThreads,
      (page) => page.threads,
      options.signal,
      true
    )
    if (options.signal?.aborted) return { status: 'aborted' }
    if (!result.ok) return { status: 'failed', cause: result.cause }
    const { items, stopReason } = result.value
    return stopReason
      ? { status: 'incomplete', reason: stopReason, threads: uniqueById(items) }
      : { status: 'complete', threads: items }
  }

  async function getIdentity(): Promise<{ userId: string }> {
    const identity = await request(
      'get_agent_identity',
      '/agent/identity',
      { method: 'GET' },
      zAgentIdentity
    )
    return { userId: identity.user_id }
  }

  async function getRunMode(): Promise<AgentRunModePreference> {
    return request(
      'get_run_mode',
      '/agent/run-mode',
      { method: 'GET' },
      zAgentRunMode
    )
  }

  async function putRunMode(
    preference: AgentRunModePreference
  ): Promise<AgentRunModePreference> {
    return request(
      'put_run_mode',
      '/agent/run-mode',
      jsonInit('PUT', preference),
      zAgentRunMode
    )
  }

  async function listCloudWorkflows(): Promise<CloudWorkflowListing> {
    const result = await listAllPages(
      'list_cloud_workflows',
      '/workflows',
      zCloudWorkflowIndex,
      (page) => page.data
    )
    if (!result.ok) throw result.cause
    const { items, stopReason } = result.value
    return { entries: items, complete: stopReason === undefined }
  }

  async function getCloudWorkflow(
    workflowId: string
  ): Promise<WorkflowResponse> {
    return request(
      'get_cloud_workflow',
      `/workflows/${encodeURIComponent(workflowId)}`,
      { method: 'GET' },
      zWorkflowResponse
    )
  }

  async function getWorkflowDraft(
    workflowId: string
  ): Promise<Record<string, unknown>> {
    const { content } = await request(
      'get_workflow_draft',
      `/agent/draft?workflow_id=${encodeURIComponent(workflowId)}`,
      { method: 'GET' },
      zAgentGetDraftResponse
    )
    return content
  }

  async function getWorkflowContent(
    workflowId: string
  ): Promise<Record<string, unknown>> {
    const { workflow_json } = await request(
      'get_workflow_content',
      `/workflows/${encodeURIComponent(workflowId)}/content`,
      { method: 'GET' },
      zGetWorkflowContentResponse
    )
    return workflow_json
  }

  async function getWorkflowSidebarFile(
    workflowId: string
  ): Promise<{ path: string }> {
    const response = await request(
      'get_workflow_sidebar_file',
      `/workflows/${encodeURIComponent(workflowId)}/sidebar-file`,
      { method: 'GET' },
      zWorkflowSidebarFileResponse
    )
    return { path: response.path }
  }

  async function cancelMessage(
    threadId: string,
    messageId: string
  ): Promise<AgentCancelAccepted> {
    return request(
      'cancel_thread_message',
      `/agent/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/cancel`,
      jsonInit('POST', {}),
      zAgentCancelAccepted
    )
  }

  async function answerAsk(
    threadId: string,
    askId: string,
    answer: AgentAnswerRequest
  ): Promise<AgentAnswerReceipt> {
    return request(
      'answer_thread_ask',
      `/agent/threads/${encodeURIComponent(threadId)}/asks/${encodeURIComponent(askId)}/answer`,
      { ...jsonInit('POST', answer), timeoutMs: ANSWER_ASK_TIMEOUT_MS },
      zAgentAnswerReceipt
    )
  }

  async function deleteThread(threadId: string): Promise<void> {
    await requestEmpty(
      'delete_thread',
      `/agent/threads/${encodeURIComponent(threadId)}`,
      { method: 'DELETE' }
    )
  }

  async function refreshCredential(): Promise<void> {
    await request(
      'refresh_credential',
      '/agent/threads?limit=1',
      { method: 'GET' },
      z.unknown()
    )
  }

  async function uploadImage(
    image: Blob,
    filename: string,
    signal?: AbortSignal
  ): Promise<UploadImageResponse> {
    const form = new FormData()
    form.append('image', image, filename)
    return request(
      'upload_image',
      '/upload/image',
      {
        method: 'POST',
        body: form,
        signal,
        timeoutMs: signal ? null : undefined
      },
      zUploadImageResponse
    )
  }

  return {
    postMessage,
    getUsageStatus,
    getMessages,
    listThreads,
    getIdentity,
    getRunMode,
    putRunMode,
    listCloudWorkflows,
    getCloudWorkflow,
    getWorkflowDraft,
    getWorkflowContent,
    getWorkflowSidebarFile,
    cancelMessage,
    answerAsk,
    deleteThread,
    refreshCredential,
    uploadImage
  }
}

export type AgentRestClient = ReturnType<typeof createAgentRestClient>
