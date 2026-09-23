import type {
  AgentPostMessageRequest,
  UploadImageResponse
} from '@comfyorg/ingest-types'
import { zUploadImageResponse } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import { api } from '@/scripts/api'

import {
  zAgentAnswerAccepted,
  zAgentCancelAccepted,
  zAgentDraft,
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
  AgentDraft,
  AgentMessages,
  AgentRunModePreference,
  AgentThreadSummary,
  AgentTurnAccepted,
  CloudWorkflowEntry
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

// TEMPORARY: current_tab_unbound isn't in the generated ingest-types yet (cloud#10068 unmerged); delete this augmentation and use AgentPostMessageRequest directly once push-ingest-types-to-frontend lands it.
type AgentPostMessageRequestWithUnboundFlag = AgentPostMessageRequest & {
  current_tab_unbound?: boolean
}

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
  /**
   * The turn's target tab has no cloud id yet (a fresh, unsaved tab) - see
   * AgentPostMessageRequest['current_tab_unbound']. Tells the server this is
   * a selected-but-unbound tab rather than no tab at all, so it mints a
   * workflow for it instead of falling back to the thread's previous one and
   * presenting the turn to the model as having no workflow selected.
   */
  currentTabUnbound?: boolean
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
    init: Parameters<typeof api.fetchApi>[1],
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
    const body: AgentPostMessageRequestWithUnboundFlag = {
      content: req.content
    }
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
    if (req.currentTabUnbound !== undefined)
      body.current_tab_unbound = req.currentTabUnbound
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

  async function getDraft(workflowId: string): Promise<AgentDraft> {
    return request(
      `/agent/draft?workflow_id=${encodeURIComponent(workflowId)}`,
      { method: 'GET' },
      zAgentDraft
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
    filename: string,
    signal?: AbortSignal
  ): Promise<UploadImageResponse> {
    const form = new FormData()
    form.append('image', image, filename)
    return request(
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
    getDraft,
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
