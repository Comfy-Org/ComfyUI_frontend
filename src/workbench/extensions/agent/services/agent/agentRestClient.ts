import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import type { z } from 'zod'

import { api } from '@/scripts/api'

import {
  zAgentAnswerAccepted,
  zAgentCancelAccepted,
  zAgentError,
  zAgentMessages,
  zAgentRunMode,
  zAgentThreads,
  zAgentTurnAccepted,
  zCloudWorkflowIndex,
  zUploadImageResult
} from '../../schemas/agentApiSchema'
import type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentMessages,
  AgentRunModePreference,
  AgentThreadSummary,
  AgentTurnAccepted,
  CloudWorkflowEntry,
  UploadImageResult
} from '../../schemas/agentApiSchema'

const CLOUD_WORKFLOW_PAGE_SIZE = 100

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
    super(message)
    this.name = 'AgentApiError'
    this.status = status
    this.body = body
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export type OpenTabsSnapshot = Pick<
  AgentPostMessageRequest,
  'open_tabs' | 'current_tab'
>

/** An omitted `version` makes this content authoritative for the backend CAS. */
export interface DraftSnapshot {
  content: Record<string, unknown>
  version?: number
}

export interface PostMessageInput {
  content: string
  workflowId?: string
  selection?: Record<string, unknown>
  attachments?: string[]
  workflowReferences?: AgentPostMessageRequest['workflow_references']
  tabs?: OpenTabsSnapshot
  draft?: DraftSnapshot
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

/** `Sun, 06 Nov 1994 08:49:37 GMT` - the preferred RFC 9110 IMF-fixdate. */
const IMF_FIXDATE = new RegExp(
  `^(?:${DAY_NAME}), (\\d{2}) (${MONTH}) (\\d{4}) ${TIME_OF_DAY} GMT$`
)
/** `Sunday, 06-Nov-94 08:49:37 GMT` - the obsolete RFC 850 format. */
const RFC850_DATE = new RegExp(
  `^(?:${DAY_NAME_LONG}), (\\d{2})-(${MONTH})-(\\d{2}) ${TIME_OF_DAY} GMT$`
)
/** `Sun Nov  6 08:49:37 1994` - the obsolete asctime format, day space-padded. */
const ASCTIME_DATE = new RegExp(
  `^(?:${DAY_NAME}) (${MONTH}) (\\d{2}| \\d) ${TIME_OF_DAY} (\\d{4})$`
)

interface HttpDateFields {
  year: number
  /** 1-12, as the grammar writes it. */
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/**
 * The four-digit year an RFC 850 two-digit year stands for. RFC 9110 requires a
 * timestamp that would read as more than 50 years in the future to be taken as
 * the most recent past year with those last two digits, which is a rolling
 * window rather than the fixed pivot `Date.parse` applies.
 */
function expandTwoDigitYear(twoDigit: number): number {
  const currentYear = new Date(Date.now()).getUTCFullYear()
  const candidate = Math.floor(currentYear / 100) * 100 + twoDigit
  return candidate > currentYear + 50 ? candidate - 100 : candidate
}

function httpDateFields(value: string): HttpDateFields | undefined {
  const asMonth = (name: string) => MONTHS.indexOf(name) + 1

  const imf = IMF_FIXDATE.exec(value)
  if (imf)
    return {
      year: Number(imf[3]),
      month: asMonth(imf[2]),
      day: Number(imf[1]),
      hour: Number(imf[4]),
      minute: Number(imf[5]),
      second: Number(imf[6])
    }

  const rfc850 = RFC850_DATE.exec(value)
  if (rfc850)
    return {
      year: expandTwoDigitYear(Number(rfc850[3])),
      month: asMonth(rfc850[2]),
      day: Number(rfc850[1]),
      hour: Number(rfc850[4]),
      minute: Number(rfc850[5]),
      second: Number(rfc850[6])
    }

  const asctime = ASCTIME_DATE.exec(value)
  if (asctime)
    return {
      year: Number(asctime[6]),
      month: asMonth(asctime[1]),
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
 * rather than the rolling one RFC 9110 mandates. Every field is validated, and
 * all three formats name a UTC instant (asctime carries no zone but is defined
 * as UTC), so the result no longer varies with the engine or the host zone.
 *
 * Deliberately lenient about `day-name`: RFC 9110 asks recipients to be robust,
 * so a weekday that disagrees with the date is ignored rather than rejected.
 */
function parseHttpDate(value: string): number | undefined {
  const fields = httpDateFields(value)
  if (fields === undefined) return undefined
  const { year, month, day, hour, minute, second } = fields
  if (hour > 23 || minute > 59 || second > 60) return undefined
  // The grammar admits a leap second; no UTC instant carries one, so it reads
  // as the last ordinary second of that minute.
  const instant = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    Math.min(second, 59)
  )
  // `Date.UTC` rolls an impossible day into the next month (`31 Nov`, `29 Feb`
  // outside a leap year), so the round-trip is what proves the date exists.
  const utc = new Date(instant)
  const exists =
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  return exists ? instant : undefined
}

/**
 * A `Retry-After` delay in whole seconds, or `undefined` when the header is
 * absent or cannot be read as one. Every return honours that contract, so a
 * caller never has to repair the result: a malformed HTTP-date leaves here as
 * `undefined` rather than as the `NaN` a bare `Date.parse` would produce.
 *
 * Exported for the contract tests; production code reaches it through
 * `toApiError`.
 */
export function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) return undefined
  if (/^\d+$/.test(header)) return asDelaySeconds(Number(header))
  // A finite non-integer number (fractional, negative, exponent form) is a
  // malformed delta-seconds, not a date, so it never reaches the date branch.
  if (Number.isFinite(Number(header))) return undefined
  const deadline = parseHttpDate(header)
  if (deadline === undefined) return undefined
  return asDelaySeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
}

function asDelaySeconds(seconds: number): number | undefined {
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : undefined
}

export function createAgentRestClient() {
  async function toApiError(response: Response): Promise<AgentApiError> {
    const body = parseErrorBody(await response.text())
    const message = getErrorMessage(body, response.statusText)
    const retryAfterSeconds = parseRetryAfter(
      response.headers.get('Retry-After')
    )
    return new AgentApiError(message, response.status, body, retryAfterSeconds)
  }

  async function request<T>(
    route: string,
    init: RequestInit,
    schema: z.ZodType<T>
  ): Promise<T> {
    const response = await api.fetchApi(route, init)
    if (!response.ok) throw await toApiError(response)
    return schema.parse(await response.json())
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
    const body: Record<string, unknown> = { content: req.content }
    if (req.workflowId !== undefined) body.workflow_id = req.workflowId
    if (req.tabs !== undefined) {
      body.open_tabs = req.tabs.open_tabs
      if (req.tabs.current_tab !== undefined)
        body.current_tab = req.tabs.current_tab
    }
    if (req.workflowReferences !== undefined)
      body.workflow_references = req.workflowReferences
    if (req.selection !== undefined) body.selection = req.selection
    if (req.attachments !== undefined) body.attachments = req.attachments
    if (req.draft !== undefined) body.draft = req.draft
    return request(
      `/agent/threads/${encodeURIComponent(threadId)}/messages`,
      jsonInit('POST', body),
      zAgentTurnAccepted
    )
  }

  async function getMessages(threadId: string): Promise<AgentMessages> {
    return request(
      `/agent/threads/${encodeURIComponent(threadId)}/messages`,
      { method: 'GET' },
      zAgentMessages
    )
  }

  async function listThreads(): Promise<AgentThreadSummary[]> {
    const page = await request(
      '/agent/threads',
      { method: 'GET' },
      zAgentThreads
    )
    return page.threads
  }

  async function getRunMode(): Promise<AgentRunModePreference> {
    return request('/agent/run-mode', { method: 'GET' }, zAgentRunMode)
  }

  async function putRunMode(
    preference: AgentRunModePreference
  ): Promise<AgentRunModePreference> {
    return request(
      '/agent/run-mode',
      jsonInit('PUT', preference),
      zAgentRunMode
    )
  }

  async function listCloudWorkflows(): Promise<CloudWorkflowEntry[]> {
    const entries: CloudWorkflowEntry[] = []
    let hasMore: boolean
    let cursor: string | undefined
    const seenCursors = new Set<string>()
    do {
      const after = cursor ? `&after=${encodeURIComponent(cursor)}` : ''
      const result = await request(
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
    return entries
  }

  async function cancelMessage(
    threadId: string,
    messageId: string
  ): Promise<AgentCancelAccepted> {
    return request(
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
      `/agent/threads/${encodeURIComponent(threadId)}/asks/${encodeURIComponent(askId)}/answer`,
      jsonInit('POST', { selected }),
      zAgentAnswerAccepted
    )
  }

  async function uploadImage(
    image: Blob,
    filename: string
  ): Promise<UploadImageResult> {
    const form = new FormData()
    form.append('image', image, filename)
    return request(
      '/upload/image',
      { method: 'POST', body: form },
      zUploadImageResult
    )
  }

  return {
    postMessage,
    getMessages,
    listThreads,
    getRunMode,
    putRunMode,
    listCloudWorkflows,
    cancelMessage,
    answerAsk,
    uploadImage
  }
}

export type AgentRestClient = ReturnType<typeof createAgentRestClient>
