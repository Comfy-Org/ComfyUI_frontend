import type {
  AgentPostMessageRequest,
  UploadImageResponse,
  WorkflowResponse
} from '@comfyorg/ingest-types'
import {
  zUploadImageResponse,
  zWorkflowResponse
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import {
  markErrorReported,
  reportError
} from '@/platform/telemetry/reportError'
import type { AuthScheme } from '@/scripts/api'
import { api } from '@/scripts/api'

import {
  zAgentAnswerAccepted,
  zAgentCancelAccepted,
  zAgentError,
  zAgentMessages,
  zAgentRunMode,
  zAgentThreads,
  zAgentTurnAccepted,
  zCloudWorkflowIndex
} from '../../schemas/agentApiSchema'
import type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentMessages,
  AgentRunModePreference,
  AgentThreadSummary,
  AgentTurnAccepted,
  CloudWorkflowEntry
} from '../../schemas/agentApiSchema'

const CLOUD_WORKFLOW_PAGE_SIZE = 100

/**
 * PM-1658: tightens `fetchApi`'s shared 60s header deadline for the one
 * request a consent card's buttons wait on, since the card is held disabled
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
  | 'get_cloud_workflow'
  | 'get_run_mode'
  | 'get_thread_messages'
  | 'list_cloud_workflows'
  | 'list_threads'
  | 'post_thread_message'
  | 'put_run_mode'
  | 'upload_image'

type ReportedAuthScheme = AuthScheme | 'unreported'

/**
 * The reported message for an auth rejection, constant by construction.
 *
 * The backend's own text is what `AgentApiError` carries to the caller, but it
 * is not what gets reported: it is uncontrolled, is not needed to diagnose
 * PM-1802, and varies enough to fragment issue grouping across what is one
 * failure mode. Status, operation and auth scheme ride as tags instead.
 */
const AUTH_REJECTED_MESSAGE = 'Agent API request rejected by authentication'

export class AgentApiError extends Error {
  readonly status: number
  readonly body: unknown
  readonly retryAfterSeconds?: number

  constructor(
    message: string,
    status: number,
    body: unknown,
    retryAfterSeconds?: number
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
  }
}

export class AgentResponseUnreadableError extends Error {
  constructor(cause: unknown) {
    super('Unreadable agent response body', { cause })
    this.name = 'AgentResponseUnreadableError'
  }
}

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

/**
 * The turn POST body, plus `client_message_id`.
 *
 * Widened here rather than in `agentApiSchema.ts` because the generated types are
 * published from the cloud repo's `openapi.yaml`, so the field is only typed
 * locally until the next package release carries it. One line to delete then.
 */
type TurnPostBody = AgentPostMessageRequest & { client_message_id?: string }

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

function getErrorMessage(body: unknown, fallback: string): string {
  const plain = zAgentError.safeParse(body)
  if (plain.success) {
    return typeof plain.data.error === 'string'
      ? plain.data.error
      : plain.data.error.message
  }
  return isIngestErrorBody(body) ? body.error.message : fallback
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

export function createAgentRestClient() {
  async function toApiError(
    response: Response,
    operation: AgentApiOperation,
    authScheme: ReportedAuthScheme
  ): Promise<AgentApiError> {
    const body = parseErrorBody(await response.text())
    const message = getErrorMessage(body, response.statusText)
    const retryAfterSeconds = parseRetryAfter(
      response.headers.get('Retry-After')
    )
    // PM-1802: a prior auth-rejection alert (AgentApiError: authentication
    // method not allowed) arrived with no failing endpoint and no record of
    // which auth path was taken, so it couldn't be diagnosed. Reporting both
    // here means the next occurrence can be.
    const apiError = new AgentApiError(
      message,
      response.status,
      body,
      retryAfterSeconds
    )
    if (response.status === 401 || response.status === 403) {
      reportError(new Error(AUTH_REJECTED_MESSAGE), {
        surface: 'agent',
        errorType: 'agent_api_auth_rejected',
        tags: { operation, status: response.status, authScheme },
        level: 'warning'
      })
      // Callers still receive the backend text for the UI, but their generic
      // catch boundaries must not emit it as a second, separately-grouped
      // report after the complete bounded diagnostic above.
      markErrorReported(apiError)
    }
    return apiError
  }

  async function request<T>(
    operation: AgentApiOperation,
    route: string,
    init: Parameters<typeof api.fetchApi>[1],
    schema: z.ZodType<T>
  ): Promise<T> {
    let authScheme: ReportedAuthScheme = 'unreported'
    const response = await api.fetchApi(route, {
      ...init,
      onAuthScheme: (scheme) => {
        authScheme = scheme
      }
    })
    if (!response.ok) throw await toApiError(response, operation, authScheme)
    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      throw new AgentResponseUnreadableError(error)
    }
    return schema.parse(payload)
  }

  function jsonInit(method: string, body: unknown): RequestInit {
    return {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  }

  async function postMessage(
    threadId: string,
    req: PostMessageInput
  ): Promise<AgentTurnAccepted> {
    const body = withoutUndefined<TurnPostBody>({
      content: req.content,
      workflow_id: req.workflowId,
      open_tabs: req.tabs?.open_tabs,
      current_tab: req.tabs?.current_tab,
      workflow_references: req.workflowReferences,
      selection: req.selection,
      attachments: req.attachments,
      draft: req.draft && { content: req.draft.content },
      current_tab_unbound: req.currentTabUnbound,
      client_message_id: req.clientMessageId
    })
    return request(
      'post_thread_message',
      `/agent/threads/${encodeURIComponent(threadId)}/messages`,
      jsonInit('POST', body),
      zAgentTurnAccepted
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

  async function listThreads(): Promise<AgentThreadSummary[]> {
    const page = await request(
      'list_threads',
      '/agent/threads',
      { method: 'GET' },
      zAgentThreads
    )
    return page.threads
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
    const entries: CloudWorkflowEntry[] = []
    let hasMore: boolean
    let cursor: string | undefined
    const seenCursors = new Set<string>()
    do {
      const after = cursor ? `&after=${encodeURIComponent(cursor)}` : ''
      const result = await request(
        'list_cloud_workflows',
        `/workflows?limit=${CLOUD_WORKFLOW_PAGE_SIZE}${after}`,
        { method: 'GET' },
        zCloudWorkflowIndex
      )
      entries.push(...result.data)
      hasMore = result.pagination.has_more
      if (hasMore) {
        const nextCursor = result.pagination.next_cursor
        if (!nextCursor || seenCursors.has(nextCursor)) break
        seenCursors.add(nextCursor)
        cursor = nextCursor
      }
    } while (hasMore)
    if (hasMore)
      console.warn(
        `[agent] cloud workflow index truncated at ${entries.length} entries`
      )
    return { entries, complete: !hasMore }
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
    selected: string[]
  ): Promise<AgentAnswerAccepted> {
    return request(
      'answer_thread_ask',
      `/agent/threads/${encodeURIComponent(threadId)}/asks/${encodeURIComponent(askId)}/answer`,
      { ...jsonInit('POST', { selected }), timeoutMs: ANSWER_ASK_TIMEOUT_MS },
      zAgentAnswerAccepted
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
    getMessages,
    listThreads,
    getRunMode,
    putRunMode,
    listCloudWorkflows,
    getCloudWorkflow,
    cancelMessage,
    answerAsk,
    uploadImage
  }
}

export type AgentRestClient = ReturnType<typeof createAgentRestClient>
