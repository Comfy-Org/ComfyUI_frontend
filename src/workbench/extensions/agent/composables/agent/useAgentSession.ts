import { zAgentAskConflict } from '@comfyorg/ingest-types/zod'
import type { AgentAnswerRequest } from '@comfyorg/ingest-types'
import { useIntervalFn } from '@vueuse/core'
import { delay, xor } from 'es-toolkit'
import { computed, ref, watch } from 'vue'
import { ZodError } from 'zod'

import { i18n } from '@/i18n'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type {
  AgentErrorClass,
  AgentErrorMetadata,
  AgentStopClickedMetadata,
  AgentStopMethod,
  AgentThreadStartSource,
  AgentWorkflowBindSource
} from '@comfyorg/telemetry/types'
import { clearLegacyAgentStorage } from '@/platform/workflow/persistence/base/storageIO'
import {
  getWorkspaceId,
  StorageKeys
} from '@/platform/workflow/persistence/base/storageKeys'
import { createUuidv4 } from '@/utils/uuid'
import type {
  AgentActiveTabData,
  AgentAnswerReceipt,
  AgentMessages,
  AgentTurnAccepted,
  AgentWsEvent,
  TurnId
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import {
  isAgentEvent,
  parseAgentWsEvent,
  toTurnId,
  zAgentAdmissionError,
  zAttachmentRejection,
  zDisownedWorkflowError,
  zTurnInProgressError
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import {
  agentRequestFailureFingerprint,
  describeAgentRequestFailure
} from '@/workbench/extensions/agent/services/agent/agentRequestFailure'
import type { AgentRequestFailureDiagnostics } from '@/workbench/extensions/agent/services/agent/agentRequestFailure'
import {
  AgentApiError,
  AgentResponseUnreadableError
} from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftSnapshot,
  OpenTabsSnapshot,
  PostMessageInput
} from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type {
  AskUserResolution,
  AssistantMessage
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import { toAskResolution } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import {
  isAttachmentKind,
  normalizeAgentTranscript
} from '@/workbench/extensions/agent/services/agent/agentTranscript'
import { TURN_RECOVERY_DELAYS_MS } from '@/workbench/extensions/agent/services/agent/turnRecoverySchedule'
import type { LiveTurn } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentSendGateStore } from '@/workbench/extensions/agent/stores/agent/agentSendGateStore'
import { useAgentWorkflowTabBindingStore } from '@/workbench/extensions/agent/stores/agent/agentWorkflowTabBindingStore'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'
import type { WorkflowReference } from '@/workbench/extensions/agent/types/workflowReference'
import { serializeWorkflowReferences } from '@/workbench/extensions/agent/utils/workflowReferenceText'

export interface AgentEventSource {
  subscribe(listener: (raw: unknown) => void): () => void
  onStatus?(listener: (live: boolean) => void): () => void
}

interface SessionNotice {
  level: 'error'
  text: string
}

type SentAttachment = Pick<
  ComposerAttachment,
  'ref' | 'name' | 'previewUrl' | 'mediaUrl' | 'mediaKind'
>

interface SentTag {
  id: string
  title: string
}

export interface WorkflowTurnContext {
  id?: string
  tabPath: string
}

/**
 * Workflow lookup context: omitted resolves the currently selected target,
 * `null` pins the absence of a target, and `{ tabPath }` pins its identity.
 * A send captures this before preparation so later selections cannot change
 * which workflow owns the turn.
 */
export type TurnOrigin = { tabPath: string } | null

type PromptEditState =
  | { phase: 'idle' }
  | { phase: 'stopping'; turnId: TurnId }
  | { phase: 'ready'; turnId: TurnId }

/**
 * Thread starts the session attributes through its pending source;
 * `history_select` is reported where the history picker resolves instead.
 */
export type AgentSessionThreadStartSource = Exclude<
  AgentThreadStartSource,
  'history_select'
>

export interface AgentSessionDeps {
  rest: AgentRestClient
  events: AgentEventSource
  onThreadStarted?: (source: AgentSessionThreadStartSource) => void
  onAgentEvent?: (event: AgentWsEvent) => void
  onThreadActivated?: (threadId: string | null) => void
  onAskResolved?: (askId: string) => void
  /**
   * Re-send the user's credential on an interval while a turn runs, so a long
   * local turn never outlives its token. Off in the cloud, where fetchApi
   * authenticates every request.
   */
  refreshCredentialDuringTurns?: boolean
  workflow?: {
    /** Resolve fresh versus restored startup before asynchronous hydration. */
    initialize?(hasThread: boolean): void
    // origin, when given, pins resolution to the tab that initiated the send
    // instead of the target selected when this is called - it is read
    // after prepare() so cloud ids it resolves are fresh, but must still
    // describe the pre-await originating tab, not a later switch. See
    // TurnOrigin for why "no origin tab" is a value rather than an omission.
    current(origin?: TurnOrigin): WorkflowTurnContext | undefined
    adopted(
      workflowId: string,
      sent: WorkflowTurnContext | undefined,
      previousWorkflowId: string | null
    ): void
    restored?(
      workflowId: string | undefined,
      isCurrent: () => boolean
    ): Promise<boolean> | boolean
    prepare?(): Promise<void>
    /** The server refused this workflow id; forget every cached trace of it. */
    disowned?(workflowId: string): void
    tabs?(origin?: TurnOrigin): OpenTabsSnapshot | undefined
    activeTab?(data: AgentActiveTabData): void
    draft?(origin?: TurnOrigin): DraftSnapshot | undefined
  }
}

const PREPARE_TIMEOUT_MS = 3000
const RECONCILE_TIMEOUT_MS = 5000

interface HydrationBuffer {
  threadId: string
  events: AgentWsEvent[]
  /**
   * Whether this buffer's own GET is still in flight. Both mailbox bounds
   * respect it: a queue whose hydrate has not come back is the one case where
   * discarding it strands a turn outright, because the transcript that lands
   * afterwards still says `streaming` and nothing is left to settle it.
   *
   * So the bounds are suspended, not merely delayed, for as long as a hydrate
   * is outstanding: such a buffer has no TTL and cannot be evicted, and
   * concurrent hung GETs can hold the map above `MAX_HYDRATION_MAILBOXES`.
   * What stays bounded meanwhile is each queue, at `MAX_HYDRATION_EVENTS`
   * frames. Settling is what restores the rest -- `drainHydration` runs from
   * the hydrate's `finally`, so an error path reaches it too, and it
   * unregisters the buffer and re-applies the cap even on a stopped session.
   */
  pending: boolean
  retirement?: ReturnType<typeof setTimeout>
  mailboxRetirement?: ReturnType<typeof setTimeout>
}

// Hydration outlives the panel that initiated it. Keep frames at page scope so
// a remounted session can claim them before installing the restored transport.
const hydrationBuffers = new Map<string, HydrationBuffer>()
const hydrationMailboxes = new Map<string, HydrationBuffer>()
const HYDRATION_HANDOFF_MS = 30_000
const HYDRATION_MAILBOX_MS = 5 * 60_000
const MAX_HYDRATION_EVENTS = 256
const MAX_HYDRATION_MAILBOXES = 32

/** Upper bound on one recovery job, including any history fetch still in flight. */
const TURN_RECOVERY_DEADLINE_MS = 60_000
const THREAD_MISSING_CONFIRMATION_INTERVAL_MS = 1000
/** How long a restored ask waits for its own broadcast before it counts as lost. */
const LATE_ASK_FRAME_GRACE_MS = 2000

/**
 * Why a recovery job is running, which is what separates an ask the socket
 * genuinely dropped from one that merely had not been published when a
 * hydrate's history fetch went out. Only the former is a defect.
 */
type RecoveryCause = 'reconnect' | 'hydrate'

type PendingAsk = NonNullable<AgentMessages[number]['pending_ask']>

type TurnOutcome =
  | {
      kind: 'terminal'
      parts: AssistantMessage['parts'] | undefined
      ending: 'completed' | 'failed'
    }
  | { kind: 'thread-missing' }
  | { kind: 'streaming'; pendingAsk: PendingAsk | undefined }
  | { kind: 'error'; cause: unknown }

function streamingPendingAskId(outcome: TurnOutcome): string | undefined {
  return outcome.kind === 'streaming' ? outcome.pendingAsk?.ask_id : undefined
}

function isTransientMissingTurn(
  outcome: TurnOutcome,
  consecutiveThreadMissing: number
): boolean {
  return outcome.kind === 'thread-missing' && consecutiveThreadMissing < 2
}

function isTerminalTurnStatus(
  status: AgentMessages[number]['status']
): boolean {
  switch (status) {
    case 'complete':
    case 'error':
    case 'interrupted':
      return true
    case 'streaming':
      return false
  }
}

function mergeAdjacentTextParts(
  parts: AssistantMessage['parts']
): AssistantMessage['parts'] {
  const merged: AssistantMessage['parts'] = []
  for (const part of parts) {
    const previous = merged.at(-1)
    if (part.type === 'text' && previous?.type === 'text') {
      previous.text += part.text
      continue
    }
    merged.push(part)
  }
  return merged
}

function terminalRecoveryParts(
  rows: AgentMessages
): AssistantMessage['parts'] | undefined {
  const parts = mergeAdjacentTextParts(
    normalizeAgentTranscript(rows).messages[0]?.parts ?? []
  )
  if (parts.length > 0) return parts
  if (rows.every((row) => row.status !== 'error')) return undefined
  return [
    {
      type: 'notice',
      level: 'error',
      text: i18n.global.t('agent.recoveredTurnFailed')
    }
  ]
}

/**
 * The status source reports its current state synchronously on subscribe
 * (see agentEventSource.onStatus), so the first callback is a snapshot, not a
 * transition. An initial `false` (still connecting) is therefore not a drop.
 */
type SocketConnection = 'initial' | 'live' | 'dropped'

function recoveryKey(turn: LiveTurn): string {
  return JSON.stringify([turn.threadId, turn.messageId])
}

function turnOutcomeFromError(error: unknown): TurnOutcome {
  if (error instanceof AgentApiError && error.status === 404)
    return { kind: 'thread-missing' }
  return { kind: 'error', cause: error }
}

const NON_RETRYABLE_REQUEST_STATUSES = new Set([
  400, 401, 403, 404, 405, 409, 410, 422
])

export function isRetryableRequestFailure(
  error: unknown,
  accepted: boolean
): boolean {
  if (accepted) return false
  if (
    error instanceof ZodError ||
    error instanceof AgentResponseUnreadableError
  )
    return false
  if (error instanceof AgentApiError)
    return !NON_RETRYABLE_REQUEST_STATUSES.has(error.status)
  return true
}

function isUnreadableAckFailure(error: unknown): boolean {
  return (
    error instanceof ZodError || error instanceof AgentResponseUnreadableError
  )
}

export function trackAgentError(
  errorClass: AgentErrorClass,
  stage: AgentErrorMetadata['failure_stage'],
  uiTreatment: AgentErrorMetadata['ui_treatment'],
  overrides: {
    retryable?: boolean
    turnAccepted?: boolean
    /**
     * FE-3200. Spread straight through, so a call site that has already built
     * the diagnosis for `reportError` passes the same record to both sinks
     * rather than deriving it twice and risking them disagreeing.
     */
    diagnostics?: AgentRequestFailureDiagnostics
  } = {}
): void {
  useTelemetry()?.trackAgentError({
    ...overrides.diagnostics,
    error_class: errorClass,
    failure_stage: stage,
    retryable: overrides.retryable ?? stage === 'pre_acceptance',
    turn_accepted: overrides.turnAccepted ?? stage === 'post_acceptance',
    ui_treatment: uiTreatment
  })
}

const REFUSED_ANSWER_STATUSES = new Set([403, 404, 501])

type AnswerFailure = 'rejected' | 'refused' | 'unconfirmed'

const ANSWER_FAILURE_ERROR_TYPES: Record<AnswerFailure, string> = {
  rejected: 'agent_ask_answer_rejected',
  refused: 'agent_ask_answer_refused',
  unconfirmed: 'agent_ask_answer_failed'
}

function classifyAnswerFailure(error: unknown): AnswerFailure {
  if (!(error instanceof AgentApiError)) return 'unconfirmed'
  if (error.status === 422) return 'rejected'
  return REFUSED_ANSWER_STATUSES.has(error.status) ? 'refused' : 'unconfirmed'
}

/**
 * PM-1658: backoff before re-driving an ask answer. The server documents
 * 5xx here as retryable and re-drives the STORED selection, so resending the
 * same answer is always safe and is the only recovery that cannot turn into a
 * contradictory second choice. One retry only: the card is disabled for the
 * whole sequence, which with ANSWER_ASK_TIMEOUT_MS keeps the worst case under
 * the shared 60s request deadline it replaces.
 */
const ANSWER_RETRY_BACKOFF_MS = [300]
const MAX_DELIVERED_ASKS = 128

/**
 * A rejected fetch never reached the server, and 5xx is the status the server
 * documents as retryable. Everything else either answered (a schema failure
 * means a 202 body we could not read — replaying it is a wasted request) or
 * refuses permanently, as 501 does on deployments with no durable turn to
 * wake.
 */
function isRetryableAnswerFailure(error: unknown): boolean {
  if (error instanceof AgentApiError)
    return error.status >= 500 && error.status !== 501
  return error instanceof TypeError || error instanceof DOMException
}

type CommittedAnswerSource = Parameters<typeof toAskResolution>[0]

function namesCommittedAnswer({
  selected,
  other_text
}: CommittedAnswerSource): boolean {
  return Array.isArray(selected) || Boolean(other_text)
}

function diffAnswers(
  submitted: AgentAnswerRequest,
  committed: Extract<AskUserResolution, { status: 'answered' }>,
  selectionKnown: boolean
) {
  return {
    selection_changed:
      selectionKnown && xor(submitted.selected, committed.selected).length > 0,
    other_text_changed:
      (submitted.other_text || undefined) !== committed.otherText
  }
}

function isSupersededAnswer(
  submitted: AgentAnswerRequest,
  committed: Extract<AskUserResolution, { status: 'answered' }>,
  selectionKnown: boolean
): boolean {
  const changes = diffAnswers(submitted, committed, selectionKnown)
  return changes.selection_changed || changes.other_text_changed
}

let sessionGeneration = 0

/**
 * Page-lifetime binding memory: the workflow a resumed turn belongs to must
 * survive a panel remount. Module-level like `sessionGeneration`;
 * newChat/loadThread clear it.
 */
let rememberedWorkflowId: string | null = null
const turnStartedAt = new Map<TurnId, number>()

/**
 * Module-level like `turnStartedAt`: a POST outlives the panel that sent it,
 * so a stop clicked from a remounted panel before the acknowledgement must
 * reach the continuation that acks. One owner: armed while a send is in
 * flight, consumed exactly once at ack.
 */
let sendInFlight = false
let stopPendingAck: { method: AgentStopMethod | undefined } | null = null

function consumeStopPendingAck() {
  const pending = stopPendingAck
  stopPendingAck = null
  return pending
}

const CREDENTIAL_REFRESH_INTERVAL_MS = 4 * 60 * 1000

function parseAdmissionError(error: unknown) {
  if (!(error instanceof AgentApiError)) return undefined
  const parsed = zAgentAdmissionError.safeParse(error.body)
  if (!parsed.success) return undefined
  const expectedStatus =
    parsed.data.error.type === 'PAYMENT_REQUIRED' ? 402 : 503
  if (error.status !== expectedStatus) return undefined
  return { ...parsed.data.error, retryAfterSeconds: error.retryAfterSeconds }
}

function isAttachmentTypeRejection(error: unknown): boolean {
  return (
    error instanceof AgentApiError &&
    error.status === 422 &&
    zAttachmentRejection.safeParse(error.body).success
  )
}

function reportSendFailure(error: unknown): void {
  if (isAttachmentTypeRejection(error)) return
  reportError(error, {
    surface: 'agent',
    errorType: 'agent_send_message_failed',
    tags:
      error instanceof AgentApiError
        ? {
            status: error.status,
            operation: error.operation,
            retryAfterSeconds: error.retryAfterSeconds
          }
        : undefined
  })
}

function disownsWorkflow(error: unknown): boolean {
  return (
    error instanceof AgentApiError &&
    error.status === 403 &&
    zDisownedWorkflowError.safeParse(pendingServerFact('BE-20403', error.body))
      .success
  )
}

function parseTurnInProgress(error: unknown) {
  if (!(error instanceof AgentApiError) || error.status !== 409)
    return undefined
  const parsed = zTurnInProgressError.safeParse(
    pendingServerFact('BE-20403', error.body)
  )
  return parsed.success ? parsed.data : undefined
}

export function useAgentSession(deps: AgentSessionDeps) {
  const {
    rest,
    events,
    onThreadStarted,
    onAgentEvent,
    onThreadActivated,
    onAskResolved,
    refreshCredentialDuringTurns = false,
    workflow
  } = deps
  const threadStorageKey = StorageKeys.agentThread(getWorkspaceId())
  clearLegacyAgentStorage()

  const conversationStore = useAgentConversationStore()
  const sendGateStore = useAgentSendGateStore()
  const skillPacks = useSkillPacksStore()
  const skillTurnUsage = new Map<string, { scope: string; used: boolean }>()
  watch(
    () => skillPacks.scope,
    () => {
      for (const usage of skillTurnUsage.values()) {
        usage.used = false
        usage.scope = ''
      }
    },
    { flush: 'sync' }
  )

  function pruneSkillTurns(): void {
    const liveKeys = new Set(conversationStore.liveTurns().map(recoveryKey))
    for (const key of skillTurnUsage.keys()) {
      if (!liveKeys.has(key)) skillTurnUsage.delete(key)
    }
  }

  function observeSkillTurn(turn: LiveTurn, scope = skillPacks.scope): void {
    if (
      !conversationStore
        .liveTurns()
        .some((live) => recoveryKey(live) === recoveryKey(turn))
    )
      return
    const key = recoveryKey(turn)
    const usage = skillTurnUsage.get(key) ?? { scope, used: false }
    usage.used ||= conversationStore.turnUsesSkill(turn)
    skillTurnUsage.set(key, usage)
  }

  function finishSkillTurn(turn: LiveTurn): void {
    observeSkillTurn(turn)
    const key = recoveryKey(turn)
    const usage = skillTurnUsage.get(key)
    skillTurnUsage.delete(key)
    if (usage?.used && skillPacks.isCurrentScope(usage.scope)) {
      void skillPacks.refreshPacksInBackground()
    }
  }

  const bindingStore = useAgentWorkflowTabBindingStore()
  /**
   * The workflow the session is bound to (set on turn ack or an active-tab
   * switch, cleared by newChat/loadThread) - the CRDT follower's subscribe
   * target.
   */
  const boundWorkflowId = ref<string | null>(rememberedWorkflowId)

  const unadoptedMintBinding = new Map<string, string | null>()

  /**
   * H8 reporting state, kept beside the binding it describes: the workflow
   * last reported for the current thread (suppresses the ack's re-report of a
   * transition already committed by a selection), and a target selection
   * committed before its thread exists, consumed by the ack that binds it.
   */
  let reportedWorkflowBind: { threadId: string; workflowId: string } | null =
    null
  let pendingWorkflowBind: {
    workflowId: string
    previousWorkflowId: string | null
    source: 'selector_chip' | 'restored'
  } | null = null

  function reportWorkflowBound(
    workflowId: string,
    previousWorkflowId: string | null,
    source: AgentWorkflowBindSource
  ): void {
    const currentThreadId = conversationStore.threadId
    if (currentThreadId === null) {
      if (source === 'selector_chip' || source === 'restored')
        pendingWorkflowBind = { workflowId, previousWorkflowId, source }
      return
    }
    const pending =
      pendingWorkflowBind?.workflowId === workflowId
        ? pendingWorkflowBind
        : null
    pendingWorkflowBind = null
    const lastReported =
      reportedWorkflowBind?.threadId === currentThreadId
        ? reportedWorkflowBind.workflowId
        : (pending?.previousWorkflowId ?? previousWorkflowId)
    if (workflowId === lastReported) return
    reportedWorkflowBind = { threadId: currentThreadId, workflowId }
    useTelemetry()?.trackAgentWorkflowBound({
      thread_id: currentThreadId,
      workflow_id: workflowId,
      prev_workflow_id: lastReported,
      bind_source: pending?.source ?? source
    })
  }

  const notices = ref<SessionNotice[]>([])
  const readyThreadId = ref<string | null>(null)
  const promptEditState = ref<PromptEditState>({ phase: 'idle' })
  const sending = ref(false)
  const answeringAskIds = computed(() => conversationStore.answeringAskIds)
  const pendingThreadSource = ref<AgentSessionThreadStartSource | null>(
    'first_open'
  )

  useIntervalFn(() => {
    if (!refreshCredentialDuringTurns) return
    if (conversationStore.liveTurns().length === 0) return
    rest.refreshCredential().catch((error: unknown) =>
      reportError(error, {
        surface: 'agent',
        errorType: 'failure_refreshing_agent_credential',
        level: 'warning'
      })
    )
  }, CREDENTIAL_REFRESH_INTERVAL_MS)

  function nextLocalErrorId(): TurnId {
    return toTurnId(`local-error-${createUuidv4()}`)
  }

  let unsubscribe: (() => void) | null = null
  let unsubscribeStatus: (() => void) | null = null
  let unsubscribeSnapshotSettled: (() => void) | null = null
  let ownedGeneration = 0
  let connection: SocketConnection = 'initial'
  let receivedStatusSnapshot = false
  let resolutionChannelEpoch = 0
  interface RunningRecovery {
    controller: AbortController
    cause: RecoveryCause
    rerun: boolean
    rerunCause: RecoveryCause
    automaticRerun: boolean
  }
  interface MissingThreadObservation {
    count: number
    observedAt: number
  }
  const recoveringTurns = new Map<string, RunningRecovery>()
  interface PendingAskObservation {
    pendingAskId: string | undefined
    deliveredAskIds: Set<string>
    observedAt: number
  }
  const recoveryPendingAskObservations = new Map<
    string,
    PendingAskObservation
  >()
  const recoveryThreadMissingCounts = new Map<
    string,
    MissingThreadObservation
  >()
  /**
   * Asks recovery must not re-deliver: one it already restored, one a frame
   * has delivered, and any the user has answered or the server has resolved.
   * Without the latter, a poll whose snapshot predates the answer would
   * resurrect a card the user is done with, splitting the reply that has
   * since resumed streaming. Deliberately outlives `newChat`/`loadThread`:
   * an `ask_id` carries its `message_id`, so it is never reused.
   */
  const deliveredAsks = new Set<string>()
  const observedDeliveredAsks = new Set<string>()
  const supersededAnswerReports = new Set<string>()
  const acceptedUnconfirmedReports = new Set<string>()
  const conflictUnconfirmedReports = new Set<string>()
  const lateAskReports = new Map<
    string,
    {
      threadId: string
      messageId: string
      timer: ReturnType<typeof setTimeout>
    }
  >()

  function recordDeliveredAsk(askId: string): void {
    observedDeliveredAsks.delete(askId)
    observedDeliveredAsks.add(askId)
    deliveredAsks.delete(askId)
    deliveredAsks.add(askId)
    for (const ledger of [deliveredAsks, observedDeliveredAsks]) {
      if (ledger.size <= MAX_DELIVERED_ASKS) continue
      const oldest = ledger.values().next().value
      if (oldest !== undefined) ledger.delete(oldest)
    }
  }

  function recordAnswerReport(reports: Set<string>, askId: string): boolean {
    if (reports.has(askId)) return false
    reports.add(askId)
    if (reports.size > MAX_DELIVERED_ASKS) {
      const oldest = reports.values().next().value
      if (oldest !== undefined) reports.delete(oldest)
    }
    return true
  }

  function recordPendingAskObservation(
    key: string,
    pendingAskId: string | undefined,
    deliveredAskIds: Set<string>
  ): PendingAskObservation {
    const observation = {
      pendingAskId,
      deliveredAskIds,
      observedAt: Date.now()
    }
    recoveryPendingAskObservations.delete(key)
    recoveryPendingAskObservations.set(key, observation)
    if (recoveryPendingAskObservations.size > MAX_DELIVERED_ASKS) {
      const oldest = recoveryPendingAskObservations.keys().next().value
      if (oldest !== undefined) recoveryPendingAskObservations.delete(oldest)
    }
    return observation
  }

  function recordThreadAvailability(key: string, outcome: TurnOutcome): number {
    const previous = recoveryThreadMissingCounts.get(key)
    if (outcome.kind === 'thread-missing') {
      const observedAt = Date.now()
      const consecutive =
        previous === undefined ||
        observedAt - previous.observedAt > TURN_RECOVERY_DEADLINE_MS
          ? 1
          : observedAt - previous.observedAt >=
              THREAD_MISSING_CONFIRMATION_INTERVAL_MS
            ? previous.count + 1
            : previous.count
      recoveryThreadMissingCounts.delete(key)
      recoveryThreadMissingCounts.set(key, { count: consecutive, observedAt })
      return consecutive
    }
    recoveryThreadMissingCounts.delete(key)
    return previous?.count ?? 0
  }

  function pruneRecoveryLedgers(): void {
    while (recoveryThreadMissingCounts.size > MAX_DELIVERED_ASKS) {
      const oldest = recoveryThreadMissingCounts.keys().next().value
      if (oldest === undefined) break
      recoveryThreadMissingCounts.delete(oldest)
    }
  }

  function lateAskReportKey(threadId: string, askId: string): string {
    return `${threadId}\u0000${askId}`
  }

  function clearLateAskReports(threadId?: string): void {
    for (const [key, scheduled] of lateAskReports) {
      if (threadId !== undefined && scheduled.threadId !== threadId) continue
      clearTimeout(scheduled.timer)
      lateAskReports.delete(key)
    }
  }

  function pushError(text: string): void {
    notices.value.push({ level: 'error', text })
  }

  const malformedStreamReports = new Map<TurnId | null, boolean>()

  function trackMalformedStreamEvent(
    cause: ZodError,
    eventType: string,
    turnId: TurnId | null,
    uiTreatment: AgentErrorMetadata['ui_treatment']
  ): void {
    const visible = uiTreatment !== 'none'
    const priorVisible = malformedStreamReports.get(turnId)
    if (priorVisible === true || (priorVisible === false && !visible)) return
    malformedStreamReports.set(turnId, visible)
    reportError(new Error('Malformed agent stream event'), {
      surface: 'agent',
      errorType: 'agent_malformed_stream_event',
      tags: { ui_treatment: uiTreatment, event_type: eventType },
      context: { issues: cause.issues }
    })
    trackAgentError(
      'malformed_stream_event',
      turnId === null ? 'pre_acceptance' : 'post_acceptance',
      uiTreatment,
      { retryable: false }
    )
  }

  function forgetBinding(): void {
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    unadoptedMintBinding.clear()
  }

  function initializeWorkflowContext(hasThread: boolean): void {
    workflow?.initialize?.(hasThread)
    // The binding only outlives a remount together with its thread: a page
    // with no surviving thread has no resumed turn the binding could serve.
    if (
      conversationStore.threadId === null &&
      localStorage.getItem(threadStorageKey) === null
    ) {
      rememberedWorkflowId = null
      boundWorkflowId.value = null
    }
  }

  function start({ restore = true }: { restore?: boolean } = {}): void {
    stopped = false
    readyThreadId.value = null
    ownedGeneration = ++sessionGeneration
    connection = 'initial'
    receivedStatusSnapshot = false
    const surviving = conversationStore.threadId
    const stored =
      conversationStore.messages.length === 0
        ? localStorage.getItem(threadStorageKey)
        : null
    const initialThreadId = surviving ?? stored
    initializeWorkflowContext(initialThreadId !== null)
    unsubscribe = events.subscribe(onRaw)
    if (events.onStatus) unsubscribeStatus = events.onStatus(onStatus)
    unsubscribeSnapshotSettled = conversationStore.onSnapshotTurnSettled(
      (turn) => void reconcileSettledSnapshotTurn(turn)
    ).off
    if (!restore) return
    if (initialThreadId === null) {
      onThreadActivated?.(null)
      return
    }
    void restoreInitialThread(initialThreadId, surviving)
  }

  async function restoreInitialThread(
    initialThreadId: string,
    surviving: string | null
  ): Promise<void> {
    const generation = ++loadGeneration
    const isCurrent = () =>
      generation === loadGeneration && ownedGeneration === sessionGeneration
    const stashedTurn = beginInitialThread(initialThreadId, surviving)
    const ready = await hydrateFromServer(initialThreadId, isCurrent, {
      stashedTurn
    })
    if (isCurrent()) settleInitialThread(initialThreadId, surviving, ready)
  }

  /** Returns whether a surviving thread's active turn was stashed. */
  function beginInitialThread(
    initialThreadId: string,
    surviving: string | null
  ): boolean {
    if (surviving === null) {
      conversationStore.setThreadId(initialThreadId)
      return false
    }
    const stashedTurn = conversationStore.activeTurnId !== null
    conversationStore.stashActiveTurn()
    return stashedTurn
  }

  function settleInitialThread(
    initialThreadId: string,
    surviving: string | null,
    ready: boolean
  ): void {
    if (ready) onThreadActivated?.(initialThreadId)
    else if (conversationStore.threadId === null) onThreadActivated?.(null)
    if (surviving !== null && conversationStore.threadId === surviving)
      conversationStore.resumeBackgroundTurn()
  }

  /**
   * The buffer holding for each thread whose hydrate is still fetching.
   * `subscribe()` runs before the GET resolves, and until the transcript
   * installs a transport there is nothing for `ingest` to route a frame to --
   * a panel reopened over a live turn has no background entry to fall back on
   * either, so they are dropped outright. Losing an `agent_message_done` that
   * way leaves the turn the transcript then restores running for good
   * (PM-1776); losing a delta silently truncates the reply.
   *
   * More than one thread at a time is ordinary: `start()`'s hydrate is often
   * still fetching when the user picks a thread out of history. Keying by
   * thread is what makes "one buffer per thread" unrepresentable rather than
   * merely maintained.
   */
  let stopped = false

  function bufferFor(
    threadId: string | undefined,
    terminal: boolean
  ): HydrationBuffer | undefined {
    if (threadId === undefined) return undefined
    return (
      hydrationBuffers.get(threadId) ??
      (terminal ? hydrationMailboxes.get(threadId) : undefined)
    )
  }

  /**
   * Arms a buffer for the thread a hydrate is about to fetch, taking over the
   * frames of any in-flight hydrate of that thread.
   *
   * Claimed here rather than when that earlier hydrate finishes, because the
   * two GETs can resolve in either order and only this end of the overlap is
   * ordered. Replayed after ours, its older delta lands on a turn our
   * `agent_message_done` has already settled -- and both `ingest` and a
   * settled transport drop what they cannot place.
   */
  function armHydration(threadId: string): HydrationBuffer {
    const superseded =
      hydrationBuffers.get(threadId) ?? hydrationMailboxes.get(threadId)
    if (superseded?.retirement !== undefined)
      clearTimeout(superseded.retirement)
    if (superseded?.mailboxRetirement !== undefined)
      clearTimeout(superseded.mailboxRetirement)
    hydrationMailboxes.delete(threadId)
    const buffer: HydrationBuffer = {
      threadId,
      // Moved, not copied: a superseded hydrate still drains from its own
      // `finally`, and a frame left behind there is replayed a second time
      // into whatever is active by then.
      events: superseded?.events.splice(0) ?? [],
      pending: true
    }
    hydrationBuffers.set(threadId, buffer)
    buffer.retirement = setTimeout(
      () => retireHydrationCapture(buffer),
      HYDRATION_HANDOFF_MS
    )
    return buffer
  }

  function retireHydrationCapture(buffer: HydrationBuffer): void {
    if (hydrationBuffers.get(buffer.threadId) !== buffer) return
    hydrationBuffers.delete(buffer.threadId)
    mailboxHydration(buffer)
  }

  /**
   * Parks a buffer where a later hydrate of its thread can claim it, under a
   * fresh TTL and the cap. Re-armed rather than reused, because a buffer
   * reaching here a second time -- captured before its session stopped, and
   * only now settled -- skipped the first TTL while it was still pending.
   */
  function mailboxHydration(buffer: HydrationBuffer): void {
    if (buffer.mailboxRetirement !== undefined)
      clearTimeout(buffer.mailboxRetirement)
    hydrationMailboxes.delete(buffer.threadId)
    hydrationMailboxes.set(buffer.threadId, buffer)
    buffer.mailboxRetirement = setTimeout(() => {
      if (buffer.pending) return
      if (hydrationMailboxes.get(buffer.threadId) === buffer)
        hydrationMailboxes.delete(buffer.threadId)
      buffer.events.length = 0
    }, HYDRATION_MAILBOX_MS)
    enforceMailboxCap()
  }

  function enforceMailboxCap(): void {
    while (hydrationMailboxes.size > MAX_HYDRATION_MAILBOXES) {
      const oldest = [...hydrationMailboxes].find(([, held]) => !held.pending)
      if (oldest === undefined) break
      const [threadId, retired] = oldest
      hydrationMailboxes.delete(threadId)
      if (retired.mailboxRetirement !== undefined)
        clearTimeout(retired.mailboxRetirement)
      retired.events.length = 0
    }
  }

  /**
   * Replays a hydrate's frames and retires its buffer. Deferred rather than
   * immediate: `ingest` routes each one by thread and turn, so a frame whose
   * hydrate was superseded or failed still reaches the background turn it
   * belongs to -- and a background turn that never receives its own
   * `agent_message_done` is one `resumeBackgroundTurn` later restores as
   * permanently running. Idempotent, so the success path and the `finally`
   * can both call it.
   *
   * Delivery is best-effort, and of its bounds only the per-queue one always
   * holds. A thread captures for `HYDRATION_HANDOFF_MS` from the moment its
   * hydrate is armed; past that the queue becomes a mailbox a later hydrate
   * of the same thread can still claim. That mailbox expires after
   * `HYDRATION_MAILBOX_MS` and gives way once it is no longer among the
   * newest `MAX_HYDRATION_MAILBOXES` threads -- but both are suspended while
   * its own GET is outstanding (see `pending`), so an unsettled hydrate keeps
   * its mailbox past either, and settling is what reimposes them. A queue
   * holds `MAX_HYDRATION_EVENTS` frames throughout, evicting non-terminal
   * ones first so an `agent_message_done` -- the frame whose loss strands a
   * turn -- outlives the deltas around it.
   *
   * Only ever deletes its own registration: a superseded hydrate draining
   * late would otherwise unregister the buffer that replaced it, leaving the
   * live hydrate's frames with nowhere to be held.
   */
  function drainHydration(buffer: HydrationBuffer): void {
    // Unregistering is not gated on `stopped`. The mailbox TTL is one-shot
    // and returns early while this buffer is pending, so settling is the
    // only remaining owner of the registration -- returning first would
    // strand the entry, and its frames, for the life of the page.
    buffer.pending = false
    if (buffer.retirement !== undefined) clearTimeout(buffer.retirement)
    if (buffer.mailboxRetirement !== undefined)
      clearTimeout(buffer.mailboxRetirement)
    if (hydrationBuffers.get(buffer.threadId) === buffer)
      hydrationBuffers.delete(buffer.threadId)
    if (hydrationMailboxes.get(buffer.threadId) === buffer)
      hydrationMailboxes.delete(buffer.threadId)
    const events = buffer.events.splice(0)
    if (stopped) {
      // Nothing here can replay, but these frames are owed to the successor
      // -- discarding a captured `done` strands the very turn its hydrate
      // will restore as streaming. Parked instead, and now under bounds that
      // bite: no longer pending, so the fresh TTL and the cap both apply.
      if (events.length === 0) return
      buffer.events.push(...events)
      mailboxHydration(buffer)
      return
    }
    for (const event of events) {
      try {
        handleAgentEvent(event)
      } catch (error) {
        reportError(error, {
          surface: 'agent',
          errorType: 'agent_hydration_replay_failed'
        })
      }
    }
  }

  /**
   * Turns whose liveness came from a transcript snapshot rather than from a
   * turn this client started. A snapshot is taken at one instant and the
   * stream carries no replay, so a terminal frame broadcast before this
   * session's socket attached reaches nobody: the row still read `streaming`
   * when the GET ran, and the frame that would have settled it is gone. Such a
   * turn has no in-flight local content to protect, which is what lets a 409
   * retire it outright.
   */
  const snapshotTurns = new Set<TurnId>()

  function rememberSnapshotTurn(turnId: TurnId | null): void {
    if (turnId !== null) snapshotTurns.add(turnId)
  }

  async function applyHydration(
    threadId: string,
    history: AgentMessages,
    buffer: HydrationBuffer,
    isCurrent: () => boolean
  ): Promise<boolean> {
    if (conversationStore.threadId !== threadId || !isCurrent()) return false
    conversationStore.hydrate(history)
    rememberSnapshotTurn(conversationStore.activeTurnId)
    reconcileLiveTurns('hydrate')
    readyThreadId.value = threadId
    drainHydration(buffer)
    const workflowReady = await workflow?.restored?.(
      conversationStore.latestWorkflowId,
      isCurrent
    )
    return (
      workflowReady !== false &&
      conversationStore.threadId === threadId &&
      isCurrent()
    )
  }

  async function hydrateFromServer(
    threadId: string,
    isCurrent: () => boolean = () => true,
    {
      stashedTurn = false,
      openThread,
      failureNotice = 'error_overlay'
    }: {
      stashedTurn?: boolean
      openThread?: () => void
      failureNotice?: 'error_overlay' | 'inline_notice'
    } = {}
  ): Promise<boolean> {
    const buffer = armHydration(threadId)
    try {
      const history = await rest.getMessages(threadId)
      if (openThread && isCurrent()) openThread()
      return await applyHydration(threadId, history, buffer, isCurrent)
    } catch (error) {
      return handleHistoryLoadError(
        error,
        threadId,
        isCurrent,
        stashedTurn,
        failureNotice
      )
    } finally {
      drainHydration(buffer)
    }
  }

  function handleHistoryLoadError(
    error: unknown,
    threadId: string,
    isCurrent: () => boolean,
    stashedTurn: boolean,
    failureNotice: 'error_overlay' | 'inline_notice'
  ): false {
    if (!isCurrent()) return false
    if (error instanceof AgentApiError && error.status === 404) {
      if (conversationStore.threadId === threadId)
        conversationStore.setThreadId(null)
      if (localStorage.getItem(threadStorageKey) === threadId)
        localStorage.removeItem(threadStorageKey)
      return false
    }
    const diagnostics = describeAgentRequestFailure(error)
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_history_load_failed',
      tags: diagnostics,
      fingerprint: agentRequestFailureFingerprint(
        'agent_history_load_failed',
        diagnostics
      )
    })
    if (failureNotice === 'error_overlay')
      pushError(error instanceof Error ? error.message : String(error))
    trackAgentError('history_load_failed', 'pre_acceptance', failureNotice, {
      retryable: isRetryableRequestFailure(error, false),
      turnAccepted: stashedTurn,
      diagnostics
    })
    return false
  }

  function stop(): void {
    stopped = true
    readyThreadId.value = null
    unsubscribe?.()
    unsubscribeStatus?.()
    unsubscribeSnapshotSettled?.()
    unsubscribe = null
    unsubscribeStatus = null
    unsubscribeSnapshotSettled = null
    for (const running of recoveringTurns.values()) running.controller.abort()
    recoveringTurns.clear()
    recoveryPendingAskObservations.clear()
    recoveryThreadMissingCounts.clear()
    clearLateAskReports()
    const stoppedGeneration = ownedGeneration
    queueMicrotask(() => {
      if (stoppedGeneration !== sessionGeneration) return
      loadGeneration++
      turnStartedAt.clear()
      skillTurnUsage.clear()
      conversationStore.abortActiveTurn()
      conversationStore.dropBackgroundTurns()
    })
  }

  async function prepareWorkflow(): Promise<void> {
    if (!workflow?.prepare) return
    await Promise.race([
      workflow.prepare().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, PREPARE_TIMEOUT_MS))
    ])
  }

  function recordUnavailableTarget(text: string): void {
    conversationStore.recordFailedSend(
      nextLocalErrorId(),
      text,
      i18n.global.t('agent.targetNavigationUnavailable')
    )
  }

  function refusesTarget(
    text: string,
    originContext: WorkflowTurnContext | undefined,
    wfContext: WorkflowTurnContext | undefined,
    draft: DraftSnapshot | undefined
  ): boolean {
    const refused =
      workflowTargetChanged(originContext, wfContext) ||
      lacksCanvasForRemint(wfContext, draft)
    if (refused) recordUnavailableTarget(text)
    return refused
  }

  function postTurn(
    threadId: string,
    input: PostMessageInput,
    wfContext: WorkflowTurnContext | undefined
  ): Promise<AgentTurnAccepted> {
    if (wfContext?.id === undefined) return rest.postMessage(threadId, input)
    return rest.postMessage(threadId, { ...input, workflowId: wfContext.id })
  }

  function buildPostInput(
    threadId: string,
    text: string,
    origin: TurnOrigin,
    wfContext: WorkflowTurnContext | undefined,
    draft: DraftSnapshot | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    selectionWorkflowId?: () => string | undefined,
    clientMessageId?: string
  ): PostMessageInput {
    const tabs = workflow?.tabs?.(origin)
    const unboundTarget = isUnboundTarget(
      wfContext,
      boundWorkflowId.value,
      draft,
      tabs
    )
    const selectedWorkflowId = selectionWorkflowId?.()
    return {
      content: serializeWorkflowReferences(text, workflowReferences ?? []),
      tabs,
      workflowReferences: serializeReferencedWorkflows(
        workflowReferences,
        wfContext?.id
      ),
      selection: selectedNodes(tags, selectedWorkflowId),
      attachments: attachments?.map((attachment) => attachment.ref),
      clientMessageId,
      ...buildTargetFields(threadId, wfContext, draft, unboundTarget)
    }
  }

  function serializeReferencedWorkflows(
    references: WorkflowReference[] | undefined,
    currentWorkflowId: string | undefined
  ) {
    return (references ?? [])
      .filter((reference) => reference.id !== currentWorkflowId)
      .map((reference) => ({
        workflow_id: reference.id,
        name: reference.name
      }))
  }

  function selectedNodes(
    tags: SentTag[] | undefined,
    selectedWorkflowId: string | undefined
  ) {
    if (tags === undefined || tags.length === 0) return undefined
    return {
      node_ids: tags.map((tag) => tag.id),
      ...(selectedWorkflowId !== undefined
        ? { workflow_id: selectedWorkflowId }
        : {})
    }
  }

  function canSendDraft(
    threadId: string,
    wfContext: WorkflowTurnContext | undefined,
    draft: DraftSnapshot | undefined,
    unboundTarget: boolean
  ): boolean {
    if (draft === undefined) return false
    return threadId === 'new' || wfContext?.id !== undefined || unboundTarget
  }

  function isUnboundTarget(
    wfContext: WorkflowTurnContext | undefined,
    boundWorkflowId: string | null,
    draft: DraftSnapshot | undefined,
    tabs: OpenTabsSnapshot | undefined
  ): boolean {
    if (wfContext === undefined || wfContext.id !== undefined) return false
    if (mintAlreadyRequested(wfContext.tabPath, boundWorkflowId)) return false
    if (boundWorkflowId === null) return true
    if (draft === undefined) return false
    return hasContent(draft) || isOpenInATab(boundWorkflowId, tabs)
  }

  function hasContent(draft: DraftSnapshot): boolean {
    const { nodes, groups } = draft.content
    return [nodes, groups].some(
      (items) => Array.isArray(items) && items.length > 0
    )
  }

  function isOpenInATab(
    workflowId: string,
    tabs: OpenTabsSnapshot | undefined
  ): boolean {
    return (tabs?.open_tabs ?? []).some((tab) => tab.workflow_id === workflowId)
  }

  function mintAlreadyRequested(
    tabPath: string,
    boundWorkflowId: string | null
  ): boolean {
    return (
      unadoptedMintBinding.has(tabPath) &&
      unadoptedMintBinding.get(tabPath) === boundWorkflowId
    )
  }

  function rememberMint(
    input: PostMessageInput,
    wfContext: WorkflowTurnContext | undefined,
    workflowId: string | undefined
  ): void {
    if (!input.currentTabUnbound || wfContext === undefined) return
    const adoptedOrHeld =
      workflowId !== undefined &&
      bindingStore.tabPathFor(workflowId) !== undefined
    if (!adoptedOrHeld)
      unadoptedMintBinding.set(wfContext.tabPath, boundWorkflowId.value)
  }

  function lacksCanvasForRemint(
    wfContext: WorkflowTurnContext | undefined,
    draft: DraftSnapshot | undefined
  ): boolean {
    if (wfContext === undefined || wfContext.id !== undefined) return false
    if (boundWorkflowId.value === null) return false
    return workflow?.draft !== undefined && draft === undefined
  }

  function buildTargetFields(
    threadId: string,
    wfContext: WorkflowTurnContext | undefined,
    draft: DraftSnapshot | undefined,
    unboundTarget: boolean
  ): Pick<PostMessageInput, 'currentTabUnbound' | 'draft'> {
    return {
      ...(unboundTarget ? { currentTabUnbound: true } : {}),
      // unboundTarget must carry its draft alongside it: the server mints a
      // workflow for it, and without the draft that mint starts empty,
      // dropping whatever is already on the tab's canvas.
      ...(canSendDraft(threadId, wfContext, draft, unboundTarget)
        ? { draft }
        : {})
    }
  }

  function recordTurnStarted(turnId: TurnId, startsThread: boolean): void {
    turnStartedAt.set(turnId, Date.now())
    if (startsThread && pendingThreadSource.value !== null) {
      const source = pendingThreadSource.value
      pendingThreadSource.value = null
      runAcceptedTurnSideEffect(
        () => onThreadStarted?.(source),
        'agent_thread_started_callback_failed'
      )
    }
  }

  function runAcceptedTurnSideEffect(
    effect: () => void,
    errorType: string
  ): void {
    try {
      effect()
    } catch (error) {
      reportError(error, { surface: 'agent', errorType })
      trackAgentError('request_failed', 'post_acceptance', 'none')
    }
  }

  function acceptTurn(
    ack: AgentTurnAccepted,
    text: string,
    wfContext: WorkflowTurnContext | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    skillScope = skillPacks.scope
  ): void {
    const startsThread = conversationStore.threadId === null
    conversationStore.setThreadId(ack.thread_id)
    let adoptWorkflow: (() => void) | undefined
    const { workflow_id: workflowId } = pendingServerFact('BE-20403', ack)
    if (workflowId !== undefined) {
      const boundAtAck = boundWorkflowId.value
      bindWorkflow(workflowId)
      const shouldAdopt =
        wfContext?.id !== undefined ||
        (workflowId !== boundAtAck &&
          bindingStore.tabPathFor(workflowId) === undefined)
      if (shouldAdopt)
        adoptWorkflow = () =>
          workflow?.adopted(workflowId, wfContext, boundAtAck)
    }
    const turnId = toTurnId(ack.message_id)
    conversationStore.recordUser(
      turnId,
      text,
      attachments?.map(({ name, previewUrl, mediaUrl, ref, mediaKind }) => ({
        name,
        previewUrl,
        mediaUrl,
        ref,
        ...(isAttachmentKind(mediaKind) ? { kind: mediaKind } : {})
      })),
      tags?.map((tag) => `${tag.title} #${tag.id}`),
      workflowReferences
    )
    conversationStore.startTurn(turnId)
    observeSkillTurn({ threadId: ack.thread_id, messageId: turnId }, skillScope)
    readyThreadId.value = ack.thread_id
    recordTurnStarted(turnId, startsThread)
    stopPendingActiveTurn()
    runAcceptedTurnSideEffect(
      () => onThreadActivated?.(ack.thread_id),
      'agent_thread_activated_callback_failed'
    )
    runAcceptedTurnSideEffect(
      () => localStorage.setItem(threadStorageKey, ack.thread_id),
      'agent_thread_persistence_failed'
    )
    if (adoptWorkflow)
      runAcceptedTurnSideEffect(
        adoptWorkflow,
        'agent_workflow_adoption_callback_failed'
      )
  }

  function stopPendingActiveTurn(): void {
    const pendingStop = consumeStopPendingAck()
    if (pendingStop !== null) void stopTurn(pendingStop.method)
  }

  function recordSendError(
    error: unknown,
    text: string,
    accepted: boolean,
    reattached: boolean
  ): void {
    const admission = parseAdmissionError(error)
    if (admission?.reason === 'no_funds') {
      conversationStore.recordPaywall(
        nextLocalErrorId(),
        text,
        admission.message
      )
      return
    }
    if (admission !== undefined) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        admission.message,
        admission.reason === 'funds_unavailable'
          ? admission.retryAfterSeconds
          : undefined
      )
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    conversationStore.recordFailedSend(
      nextLocalErrorId(),
      text,
      reattached
        ? i18n.global.t('agent.sendTurnInProgress')
        : `${i18n.global.t('agent.sendFailed')}: ${message}`
    )
    const turnAccepted = accepted || isUnreadableAckFailure(error)
    reportSendFailure(error)
    trackAgentError(
      'request_failed',
      turnAccepted ? 'post_acceptance' : 'pre_acceptance',
      'inline_notice',
      { retryable: isRetryableRequestFailure(error, turnAccepted) }
    )
  }

  function recordCurrentSendError(
    error: unknown,
    text: string,
    accepted: boolean,
    reattached: boolean,
    threadAtSend: string
  ): void {
    if (threadAtSend !== 'new' && conversationStore.threadId !== threadAtSend)
      return
    recordSendError(error, text, accepted, reattached)
  }

  /**
   * The server will not serve the id this turn was posted under, and the
   * binding that produced it outlives the page. Left in place it poisons the
   * tab: every later turn re-posts the same dead id, and a reload re-affirms
   * the binding through the thread's own workflow pointer.
   *
   * Everything here is keyed by the refused id, never by its tab path: the tab
   * may already have been rebound to a healthy workflow while the POST was in
   * flight. `disowned` evicts the id from the resolver's cloud index, which
   * `cloudIdFor` consults ahead of the binding store.
   */
  function releaseDisownedWorkflow(
    sent: WorkflowTurnContext | undefined,
    error: unknown
  ): void {
    if (sent?.id === undefined || !disownsWorkflow(error)) return
    bindingStore.unbindWorkflow(sent.id)
    workflow?.disowned?.(sent.id)
    if (boundWorkflowId.value === sent.id) boundWorkflowId.value = null
    if (rememberedWorkflowId === sent.id) rememberedWorkflowId = null
  }

  async function reattachRefusedTurn(
    error: unknown,
    threadAtSend: string,
    generation: number
  ): Promise<boolean> {
    const conflict = parseTurnInProgress(error)
    if (conflict === undefined || threadAtSend === 'new') return false
    const reattachGeneration = ++refusedTurnReattachGeneration
    const isCurrentReattachment = () =>
      reattachGeneration === refusedTurnReattachGeneration &&
      generation === loadGeneration &&
      ownedGeneration === sessionGeneration &&
      conversationStore.threadId === threadAtSend
    await Promise.race([
      hydrateFromServer(threadAtSend, isCurrentReattachment),
      new Promise<void>((resolve) => setTimeout(resolve, RECONCILE_TIMEOUT_MS))
    ])
    const activeTurnId = conversationStore.activeTurnId
    const adoptedActiveTurn =
      isCurrentReattachment() &&
      activeTurnId !== null &&
      (conflict.active_message_id === undefined ||
        activeTurnId === conflict.active_message_id)
    if (reattachGeneration === refusedTurnReattachGeneration)
      refusedTurnReattachGeneration++
    if (adoptedActiveTurn) stopPendingActiveTurn()
    return adoptedActiveTurn
  }

  async function recoverFailedSend({
    error,
    text,
    sentContext,
    accepted,
    threadAtSend,
    generation
  }: {
    error: unknown
    text: string
    sentContext: WorkflowTurnContext | undefined
    accepted: boolean
    threadAtSend: string
    generation: number
  }): Promise<false> {
    releaseDisownedWorkflow(sentContext, error)
    if (generation !== loadGeneration) return false
    const reattached = await reattachRefusedTurn(
      error,
      threadAtSend,
      generation
    )
    if (generation !== loadGeneration) return false
    recordCurrentSendError(error, text, accepted, reattached, threadAtSend)
    return false
  }

  async function performSend(
    text: string,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    selectionWorkflowId?: () => string | undefined,
    clientMessageId?: string,
    onAccepted?: () => void
  ): Promise<boolean> {
    const generation = loadGeneration
    const skillScopeAtSend = skillPacks.scope
    const threadAtSend = conversationStore.threadId ?? 'new'
    const originContext = workflow?.current()
    const origin: TurnOrigin =
      originContext === undefined ? null : { tabPath: originContext.tabPath }
    let sentContext: WorkflowTurnContext | undefined
    let accepted = false
    try {
      await prepareWorkflow()
      if (generation !== loadGeneration) return false
      const wfContext = workflow?.current(origin)
      const draft = workflow?.draft?.(origin)
      if (refusesTarget(text, originContext, wfContext, draft)) return false
      sentContext = wfContext
      const input = buildPostInput(
        threadAtSend,
        text,
        origin,
        wfContext,
        draft,
        attachments,
        tags,
        workflowReferences,
        selectionWorkflowId,
        clientMessageId
      )
      const ack = await postTurn(threadAtSend, input, wfContext)
      accepted = true
      if (!observeAcceptedTurn(generation, onAccepted)) return false
      acceptTurn(
        ack,
        text,
        wfContext,
        attachments,
        tags,
        workflowReferences,
        skillScopeAtSend
      )
      rememberMint(input, wfContext, ack.workflow_id)
      return true
    } catch (error) {
      return recoverFailedSend({
        error,
        text,
        sentContext,
        accepted,
        threadAtSend,
        generation
      })
    }
  }

  function observeAcceptedTurn(
    generation: number,
    onAccepted?: () => void
  ): boolean {
    runAcceptedTurnSideEffect(
      () => onAccepted?.(),
      'agent_turn_accepted_callback_failed'
    )
    return generation === loadGeneration
  }

  function workflowTargetChanged(
    origin: WorkflowTurnContext | undefined,
    current: WorkflowTurnContext | undefined
  ): boolean {
    if (origin?.id === undefined) return false
    return current?.id !== origin.id
  }

  async function sendMessage(
    text: string,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    selectionWorkflowId?: () => string | undefined,
    clientMessageId?: string,
    onAccepted?: () => void
  ): Promise<boolean> {
    if (sending.value) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        i18n.global.t('agent.sendBusy')
      )
      return false
    }
    promptEditState.value = { phase: 'idle' }
    sending.value = true
    const releaseSendGate = sendGateStore.begin()
    sendInFlight = true
    stopPendingAck = null
    try {
      const sent = await performSend(
        text,
        attachments,
        tags,
        workflowReferences,
        selectionWorkflowId,
        clientMessageId,
        onAccepted
      )
      if (!sent) stopPendingAck = null
      return sent
    } finally {
      sending.value = false
      releaseSendGate()
      sendInFlight = false
    }
  }

  function captureStopMetadata(
    turnId: TurnId,
    method: AgentStopMethod | undefined
  ): AgentStopClickedMetadata | null {
    if (method === undefined) return null
    const startedAt = turnStartedAt.get(turnId)
    return {
      method,
      turn_id: turnId,
      turn_elapsed_ms:
        startedAt === undefined ? null : Math.max(0, Date.now() - startedAt)
    }
  }

  function forgetActiveTurnStartedAt(): void {
    const activeTurnId = conversationStore.activeTurnId
    if (activeTurnId !== null) turnStartedAt.delete(activeTurnId)
  }

  function isStoppingTurn(turnId: TurnId): boolean {
    return (
      promptEditState.value.phase === 'stopping' &&
      promptEditState.value.turnId === turnId
    )
  }

  function trackCommittedStop(metadata: AgentStopClickedMetadata | null): void {
    if (metadata !== null) useTelemetry()?.trackAgentStopClicked(metadata)
  }

  function releaseStoppingPhase(turnId: TurnId): void {
    if (isStoppingTurn(turnId)) promptEditState.value = { phase: 'idle' }
  }

  function abandonedStop(turnId: TurnId): boolean {
    return conversationStore.activeTurnId !== turnId
  }

  /**
   * Re-reads the thread so a persisted terminal row can replace the stale
   * `streaming` snapshot this Stop was answered for, then retires the
   * snapshot's provenance.
   *
   * Bounded, because `stopTurn` awaits this and the composer sits in
   * `stopping` until it returns: an unbounded GET would cost the user the one
   * escape from the orphan this path exists to retire. The hydrate's own
   * currency check carries the turn as well as the thread, so a response that
   * arrives after the turn settled and a newer send took the active slot is
   * discarded instead of overwriting the newer transport.
   */
  async function reconcileSnapshotTurn(turnId: TurnId): Promise<void> {
    const threadId = conversationStore.threadId
    if (threadId !== null)
      await Promise.race([
        hydrateFromServer(
          threadId,
          () =>
            conversationStore.threadId === threadId &&
            conversationStore.activeTurnId === turnId
        ),
        new Promise<void>((resolve) =>
          setTimeout(resolve, RECONCILE_TIMEOUT_MS)
        )
      ])
    if (conversationStore.activeTurnId === turnId)
      conversationStore.abortActiveTurn()
    snapshotTurns.delete(turnId)
  }

  function reportStopFailure(error: unknown, retryable: boolean): void {
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_cancel_turn_failed'
    })
    pushError(error instanceof Error ? error.message : String(error))
    trackAgentError('cancel_failed', 'post_acceptance', 'error_overlay', {
      retryable
    })
  }

  async function handleStopFailure(
    error: unknown,
    turnId: TurnId
  ): Promise<void> {
    if (abandonedStop(turnId)) {
      releaseStoppingPhase(turnId)
      return
    }
    const status = error instanceof AgentApiError ? error.status : undefined
    // 409 and 404 both say the server has no turn to stop, but only for a turn
    // restored from a snapshot is that the end of it. A turn this client
    // started has a stream that will settle it, and neither status proves
    // otherwise: a 409 still owes its trailing frames, and a 404 answers a
    // cancel that beat the run into existence as readily as one that outlived
    // it. Tearing either down would abandon a turn the server goes on to run
    // -- the state this whole change exists to remove.
    if ((status === 404 || status === 409) && snapshotTurns.has(turnId)) {
      try {
        await reconcileSnapshotTurn(turnId)
      } finally {
        releaseStoppingPhase(turnId)
      }
      return
    }
    // A 409 for a turn we started is swallowed whole: `handleMessageDone`
    // settles it, keeps the trailing content, and promotes the phase to
    // `ready`, the only route to an editable prompt.
    if (status === 409) return
    releaseStoppingPhase(turnId)
    reportStopFailure(
      error,
      status === undefined ? true : isRetryableRequestFailure(error, false)
    )
  }

  async function stopTurn(method?: AgentStopMethod): Promise<void> {
    const threadId = conversationStore.threadId
    const turnId = conversationStore.activeTurnId
    if (threadId === null || turnId === null) {
      // The POST has not acked yet; remember the intent and cancel on ack.
      // sendInFlight, not this instance's sending: the panel that posted may
      // have been remounted, and the stop arrives through the new instance.
      if (sendInFlight) stopPendingAck = { method }
      return
    }
    if (isStoppingTurn(turnId)) return
    promptEditState.value = { phase: 'stopping', turnId }
    const stopMetadata = captureStopMetadata(
      conversationStore.activeMessageId ?? turnId,
      method
    )
    try {
      await rest.cancelMessage(threadId, turnId)
      trackCommittedStop(stopMetadata)
    } catch (error) {
      await handleStopFailure(error, turnId)
    }
  }

  async function answerAsk(
    askId: string,
    answer: AgentAnswerRequest | 'run' | 'cancel'
  ): Promise<boolean> {
    const currentThreadId = conversationStore.threadId
    if (currentThreadId === null) {
      failUnroutableAsk(askId)
      return false
    }
    if (answeringAskIds.value.has(askId)) return false
    const legacyRunApprovalAnswer = typeof answer === 'string'
    const runApprovalAnswer =
      legacyRunApprovalAnswer ||
      conversationStore.askKind(askId) === 'runApproval'
    const normalizedAnswer = legacyRunApprovalAnswer
      ? { selected: [answer] }
      : answer
    conversationStore.recordAskAnswer(askId, normalizedAnswer, currentThreadId)
    conversationStore.setAskAnswering(askId, true)
    const answerChannelEpoch = resolutionChannelEpoch
    const answerStartedBeforeFirstOpen = connection === 'initial'
    const answerStartedDropped = connection === 'dropped'
    const resolutionChannelDropped = () =>
      answerStartedDropped || resolutionChannelEpoch !== answerChannelEpoch
    const resolutionChannelWasLost = () =>
      answerStartedBeforeFirstOpen || resolutionChannelDropped()
    try {
      const receipt = await sendAnswer(currentThreadId, askId, normalizedAnswer)
      return commitAskReceipt({
        askId,
        answer: normalizedAnswer,
        currentThreadId,
        receipt,
        runApprovalAnswer,
        resolutionChannelDropped
      })
    } catch (error) {
      if (answeringAskIds.value.has(askId))
        return handleAnswerFailure(
          error,
          askId,
          currentThreadId,
          runApprovalAnswer,
          resolutionChannelWasLost()
        )
      return false
    }
  }

  function commitAskReceipt({
    askId,
    answer,
    currentThreadId,
    receipt,
    runApprovalAnswer,
    resolutionChannelDropped
  }: {
    askId: string
    answer: AgentAnswerRequest
    currentThreadId: string
    receipt: AgentAnswerReceipt
    runApprovalAnswer: boolean
    resolutionChannelDropped: () => boolean
  }): boolean {
    if (!receiptNamesCommittedAnswer(receipt, runApprovalAnswer))
      return commitStatusOnlyAskReceipt({
        askId,
        answer,
        currentThreadId,
        resolutionChannelDropped
      })
    const committed = toAskResolution(receipt)
    conversationStore.clearAskAwaitingResolution(askId)
    const superseded =
      committed.status === 'answered' &&
      isSupersededAnswer(answer, committed, Array.isArray(receipt.selected))
    reportSupersededAnswer(askId, receipt)
    recordDeliveredAsk(askId)
    conversationStore.commitAsk(askId, currentThreadId, committed)
    return !superseded
  }

  function receiptNamesCommittedAnswer(
    receipt: {
      status?: string
      selected?: string[] | null
      other_text?: string
    },
    runApprovalAnswer = false
  ): boolean {
    if (receipt.status !== undefined && receipt.status !== 'answered')
      return false
    if (receipt.other_text !== undefined) return true
    if (receipt.selected === undefined || receipt.selected === null)
      return false
    return !runApprovalAnswer || receipt.selected.length > 0
  }

  function commitStatusOnlyAskReceipt({
    askId,
    answer,
    currentThreadId,
    resolutionChannelDropped
  }: {
    askId: string
    answer: AgentAnswerRequest
    currentThreadId: string
    resolutionChannelDropped: () => boolean
  }): boolean {
    const channelDropped = resolutionChannelDropped()
    const resolutionStillPending =
      conversationStore.submittedAskAnswer(askId) !== undefined
    if (resolutionStillPending)
      reportAcceptedRecoveredAnswer(askId, channelDropped)
    recordDeliveredAsk(askId)
    conversationStore.commitAsk(askId, currentThreadId, { status: 'retired' })
    if (resolutionStillPending && !channelDropped) {
      conversationStore.recordAskAnswer(askId, answer, currentThreadId)
      conversationStore.markAskAwaitingResolution(askId, 'accepted')
    }
    return !supersededAnswerReports.has(askId)
  }

  function failUnroutableAsk(askId: string): void {
    reportError(new Error('agent ask answered with no thread to send on'), {
      surface: 'agent',
      errorType: 'agent_ask_answer_unroutable'
    })
    pushError(i18n.global.t('agent.runApproval.answerFailed'))
    recordDeliveredAsk(askId)
    conversationStore.retireAsk(askId, { status: 'retired' })
  }

  function reportAcceptedRecoveredAnswer(
    askId: string,
    resolutionChannelWasLost: boolean
  ): void {
    if (
      !resolutionChannelWasLost ||
      !recordAnswerReport(acceptedUnconfirmedReports, askId)
    )
      return
    reportError(new Error('accepted restored approval cannot be verified'), {
      surface: 'agent',
      errorType: 'agent_ask_answer_winner_unconfirmed'
    })
    pushError(i18n.global.t('agent.runApproval.answerAcceptedUnconfirmed'))
  }

  function reportUnconfirmedConflict(askId: string): void {
    if (!recordAnswerReport(conflictUnconfirmedReports, askId)) return
    reportError(new Error('restored approval conflict cannot be verified'), {
      surface: 'agent',
      errorType: 'agent_ask_answer_unconfirmed'
    })
    pushError(i18n.global.t('agent.runApproval.answerUncertain'))
  }

  function handleAnswerFailure(
    error: unknown,
    askId: string,
    threadId: string,
    runApprovalAnswer: boolean,
    resolutionChannelWasLost = connection === 'dropped'
  ): boolean {
    conversationStore.clearAskAwaitingResolution(askId)
    if (error instanceof AgentApiError && error.status === 409) {
      return handleConflictAnswerFailure(
        error,
        askId,
        threadId,
        runApprovalAnswer,
        resolutionChannelWasLost
      )
    }
    const failure = classifyAnswerFailure(error)
    reportError(error, {
      surface: 'agent',
      errorType: ANSWER_FAILURE_ERROR_TYPES[failure]
    })
    trackAgentError('ask_answer_failed', 'post_acceptance', 'error_overlay', {
      retryable: isRetryableRequestFailure(error, false)
    })
    const settle: Record<AnswerFailure, () => void> = {
      rejected: () => {
        deliveredAsks.delete(askId)
        conversationStore.takeSubmittedAskAnswer(askId)
        conversationStore.setAskAnswering(askId, false)
        pushError(i18n.global.t('agent.askUser.answerRejected'))
      },
      refused: () => {
        pushError(i18n.global.t('agent.runApproval.answerFailed'))
        conversationStore.retireAsk(askId, { status: 'retired' }, threadId)
      },
      unconfirmed: () => {
        recordDeliveredAsk(askId)
        conversationStore.retireAsk(askId, { status: 'unconfirmed' }, threadId)
        pushError(i18n.global.t('agent.runApproval.answerUncertain'))
      }
    }
    settle[failure]()
    return false
  }

  function handleConflictAnswerFailure(
    error: AgentApiError,
    askId: string,
    threadId: string,
    runApprovalAnswer: boolean,
    resolutionChannelWasLost: boolean
  ): boolean {
    const conflict = zAgentAskConflict.safeParse(error.body)
    if (
      conflict.success &&
      conflict.data.status !== undefined &&
      conflict.data.status !== 'answered'
    ) {
      conversationStore.retireAsk(
        askId,
        toAskResolution(conflict.data),
        threadId
      )
      return false
    }
    const submitted = conversationStore.submittedAskAnswer(askId)
    if (
      conflict.success &&
      receiptNamesCommittedAnswer(conflict.data, runApprovalAnswer)
    ) {
      const committed = toAskResolution(conflict.data)
      const superseded =
        submitted !== undefined &&
        committed.status === 'answered' &&
        isSupersededAnswer(
          submitted,
          committed,
          Array.isArray(conflict.data.selected)
        )
      reportSupersededAnswer(askId, conflict.data)
      conversationStore.retireAsk(askId, committed, threadId)
      return !superseded
    }
    retireUnknownConflict(
      error,
      askId,
      threadId,
      submitted,
      resolutionChannelWasLost
    )
    return false
  }

  function retireUnknownConflict(
    error: AgentApiError,
    askId: string,
    threadId: string,
    submitted: AgentAnswerRequest | undefined,
    resolutionChannelWasLost: boolean
  ): void {
    recordDeliveredAsk(askId)
    conversationStore.retireAsk(
      askId,
      { status: resolutionChannelWasLost ? 'unconfirmed' : 'retired' },
      threadId
    )
    if (!resolutionChannelWasLost) {
      if (submitted) {
        conversationStore.recordAskAnswer(askId, submitted, threadId)
        conversationStore.markAskAwaitingResolution(askId, 'conflict')
      }
      return
    }
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_ask_answer_unconfirmed'
    })
    pushError(i18n.global.t('agent.runApproval.answerUncertain'))
  }

  function reportSupersededAnswer(
    askId: string,
    source: CommittedAnswerSource
  ): void {
    if (!namesCommittedAnswer(source)) return
    const committed = toAskResolution(source)
    if (committed.status !== 'answered') return
    const submitted = conversationStore.takeSubmittedAskAnswer(askId)
    if (submitted === undefined) return
    const selectionKnown = Array.isArray(source.selected)
    const changes = diffAnswers(submitted.answer, committed, selectionKnown)
    if (
      (!changes.selection_changed && !changes.other_text_changed) ||
      !recordAnswerReport(supersededAnswerReports, askId)
    )
      return
    reportError(new Error('agent ask resolved with a different answer'), {
      surface: 'agent',
      errorType: 'agent_ask_answer_superseded',
      tags: {
        ...changes,
        selection_known: selectionKnown,
        committed_selected_count: selectionKnown
          ? committed.selected.length
          : undefined,
        submitted_selected_count: submitted.answer.selected.length,
        ask_kind: submitted.kind
      }
    })
    pushError(i18n.global.t('agent.runApproval.answerSuperseded'))
  }

  async function sendAnswer(
    threadId: string,
    askId: string,
    answer: AgentAnswerRequest
  ): Promise<AgentAnswerReceipt> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await rest.answerAsk(threadId, askId, answer)
      } catch (error) {
        if (
          attempt >= ANSWER_RETRY_BACKOFF_MS.length ||
          !isRetryableAnswerFailure(error)
        )
          throw error
        await new Promise((resolve) =>
          setTimeout(resolve, ANSWER_RETRY_BACKOFF_MS[attempt])
        )
      }
    }
  }

  let loadGeneration = 0
  let refusedTurnReattachGeneration = 0

  function newChat(
    source?: Exclude<AgentSessionThreadStartSource, 'first_open'>
  ): void {
    readyThreadId.value = null
    loadGeneration++
    promptEditState.value = { phase: 'idle' }
    conversationStore.stashActiveTurn()
    conversationStore.reset()
    pruneSkillTurns()
    onThreadActivated?.(null)
    forgetBinding()
    pendingWorkflowBind = null
    malformedStreamReports.clear()
    localStorage.removeItem(threadStorageKey)
    pendingThreadSource.value = source ?? null
  }

  async function loadThread(
    threadId: string,
    isNavigationCurrent: () => boolean = () => true,
    { keepOpenChatUntilLoaded = false } = {}
  ): Promise<boolean> {
    const load = {
      generation: loadGeneration,
      stashedTurn: false,
      switched: false
    }
    const isLoadCurrent = () =>
      load.generation === loadGeneration &&
      ownedGeneration === sessionGeneration
    const isCurrent = () => isLoadCurrent() && isNavigationCurrent()
    const outlivedItsNavigation = () =>
      load.switched &&
      isLoadCurrent() &&
      !isNavigationCurrent() &&
      readyThreadId.value === threadId
    function openThread(): void {
      readyThreadId.value = null
      load.generation = ++loadGeneration
      promptEditState.value = { phase: 'idle' }
      load.stashedTurn = conversationStore.activeTurnId !== null
      conversationStore.stashActiveTurn()
      forgetBinding()
      pendingWorkflowBind = null
      malformedStreamReports.clear()
      conversationStore.setThreadId(threadId)
      load.switched = keepOpenChatUntilLoaded
    }
    if (!keepOpenChatUntilLoaded) openThread()
    const hydrated = await hydrateFromServer(
      threadId,
      isCurrent,
      keepOpenChatUntilLoaded
        ? { openThread, failureNotice: 'inline_notice' }
        : { stashedTurn: load.stashedTurn }
    )
    const opened = hydrated && isCurrent()
    if (opened || outlivedItsNavigation()) {
      localStorage.setItem(threadStorageKey, threadId)
      onThreadActivated?.(threadId)
      conversationStore.resumeBackgroundTurn()
    }
    return opened
  }

  function malformedEventTurnId(raw: object): TurnId | undefined {
    if (!('data' in raw) || typeof raw.data !== 'object' || raw.data === null)
      return undefined
    if (!('message_id' in raw.data)) return undefined
    const messageId = raw.data.message_id
    return typeof messageId === 'string' ? toTurnId(messageId) : undefined
  }

  function finishSkillTurnsFor(messageId: TurnId | null): void {
    for (const turn of conversationStore.liveTurns())
      if (turn.messageId === messageId) finishSkillTurn(turn)
  }

  function handleMalformedEvent(
    type: string,
    raw: object,
    error: ZodError
  ): void {
    const turnId = malformedEventTurnId(raw)
    let reportedTurnId = turnId ?? conversationStore.activeTurnId
    let uiTreatment: AgentErrorMetadata['ui_treatment'] = 'none'
    if (type === 'agent_message_done') {
      finishSkillTurnsFor(turnId ?? conversationStore.activeTurnId)
      if (turnId !== undefined) turnStartedAt.delete(turnId)
      if (turnId === undefined || turnId === conversationStore.activeTurnId) {
        forgetActiveTurnStartedAt()
        conversationStore.abortActiveTurn()
        pushError(i18n.global.t('agent.malformedEvent'))
        uiTreatment = 'error_overlay'
      } else {
        reportedTurnId =
          conversationStore.settleBackgroundTurn(turnId) ?? reportedTurnId
      }
    }
    trackMalformedStreamEvent(error, type, reportedTurnId, uiTreatment)
  }

  function handleMessageDone(
    event: Extract<AgentWsEvent, { type: 'agent_message_done' }>
  ): void {
    turnStartedAt.delete(toTurnId(event.data.message_id))
    // Only a terminal event may hand the prompt back. A delta after Stop leaves
    // the turn live on the server, so exposing Edit there would let the resend
    // race the single-active-turn lock.
    markStoppedTurnReady({
      threadId: event.data.thread_id,
      messageId: toTurnId(event.data.message_id)
    })
  }

  /**
   * Whether the store can place this frame right now. `liveTurns()` is the
   * whole answer and is asked without qualification: it carries the active
   * slot and every unsettled background turn, each keyed by its own thread, so
   * an off-screen stash, a stash on the thread being displayed, and the active
   * turn are all one lookup. Re-deriving any part of that here is what made
   * the check right for the case under test and wrong for its sibling three
   * times over -- active-slot-only missed background turns, and keying on the
   * selected thread then missed same-thread stashes (PM-1776).
   */
  function hasRoutableLiveTurn(
    eventThreadId: string | undefined,
    eventMessageId: string | undefined
  ): boolean {
    if (eventThreadId === undefined || eventMessageId === undefined)
      return false
    return conversationStore
      .liveTurns()
      .some(
        (turn) =>
          turn.threadId === eventThreadId && turn.messageId === eventMessageId
      )
  }

  /**
   * Holds a frame a hydrate has nowhere to put yet, and reports whether
   * delivery was taken over. A routable frame is never withheld -- its
   * transport is waiting, and deferring it onto a drain the mailbox bounds can
   * cancel is how a turn gets stranded.
   *
   * A terminal frame is nevertheless *retained* as well as delivered, because
   * this session's delivery dies with it: `stop()` before the hydrate installs
   * the transcript leaves a successor facing the server's still-`streaming`
   * row, and the buffer is the only thing that carries the frame across. Only
   * the terminal one -- a delta replayed onto the transport that already took
   * it would render twice, while settling an already-settled turn is inert.
   */
  function heldForHydration(event: AgentWsEvent): boolean {
    const terminal = event.type === 'agent_message_done'
    const buffer = bufferFor(event.data.thread_id, terminal)
    if (buffer === undefined) return false
    const routable = hasRoutableLiveTurn(
      event.data.thread_id,
      event.data.message_id
    )
    if (routable && !terminal) return false
    if (buffer.events.length >= MAX_HYDRATION_EVENTS) {
      const replace = buffer.events.findIndex(
        (held) => held.type !== 'agent_message_done'
      )
      if (replace === -1 && !terminal) return true
      buffer.events.splice(Math.max(0, replace), 1)
    }
    buffer.events.push(event)
    return !routable
  }

  function handleActiveTab(
    event: Extract<AgentWsEvent, { type: 'agent_active_tab' }>
  ): void {
    if (
      event.data.thread_id === undefined ||
      event.data.thread_id === conversationStore.threadId
    )
      workflow?.activeTab?.(event.data)
  }

  /**
   * A frame that reaches the active turn rather than a buffer proves this
   * session has a stream for it, which is exactly what a snapshot-restored
   * turn was missing. From here its liveness no longer rests on the snapshot,
   * so a stop failure must leave it alone and let the stream settle it.
   */
  function observeLiveDelivery(event: AgentWsEvent): void {
    const messageId = event.data.message_id
    if (messageId !== undefined) snapshotTurns.delete(toTurnId(messageId))
  }

  function handleResolvedAsk(
    event: Extract<AgentWsEvent, { type: 'agent_ask_resolved' }>
  ): void {
    conversationStore.clearAskAwaitingResolution(event.data.ask_id)
    const resolution = toAskResolution(event.data)
    reportSupersededAnswer(event.data.ask_id, event.data)
    // The owning transport may already be gone, so retire the ask explicitly
    // before ingest can otherwise leave its card enabled.
    conversationStore.retireAsk(
      event.data.ask_id,
      resolution,
      event.data.thread_id
    )
    recordDeliveredAsk(event.data.ask_id)
    onAskResolved?.(event.data.ask_id)
  }

  function observeSkillEvent(event: AgentWsEvent): void {
    for (const turn of conversationStore.liveTurns()) observeSkillTurn(turn)
    if (event.type !== 'agent_message_done') return
    finishSkillTurn({
      threadId: event.data.thread_id,
      messageId: toTurnId(event.data.message_id)
    })
  }

  function handleAgentEvent(event: AgentWsEvent): void {
    if (heldForHydration(event)) return
    observeLiveDelivery(event)
    if (event.type === 'agent_ask_resolved') handleResolvedAsk(event)
    observeSkillEvent(event)
    if (event.type === 'agent_ask') {
      deliverAsk(event)
      for (const turn of conversationStore.liveTurns()) observeSkillTurn(turn)
      return
    }
    conversationStore.ingest(event)
    for (const turn of conversationStore.liveTurns()) observeSkillTurn(turn)
    if (event.type === 'agent_active_tab') handleActiveTab(event)
    else if (event.type === 'agent_message_done') handleMessageDone(event)
  }

  function onRaw(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    const type = (raw as { type?: unknown }).type
    if (typeof type !== 'string' || !isAgentEvent(type)) return
    const parsed = parseAgentWsEvent(raw)
    if (!parsed.success) {
      handleMalformedEvent(type, raw, parsed.error)
      return
    }
    onAgentEvent?.(parsed.data)
    handleAgentEvent(parsed.data)
  }

  function onStatus(live: boolean): void {
    if (!live) {
      if (connection === 'initial' && !receivedStatusSnapshot) {
        receivedStatusSnapshot = true
        return
      }
      receivedStatusSnapshot = true
      if (connection === 'dropped') return
      connection = 'dropped'
      resolutionChannelEpoch += 1
      for (const awaiting of conversationStore.asksAwaitingResolution())
        if (awaiting.kind === 'accepted')
          reportAcceptedRecoveredAnswer(awaiting.askId, true)
        else reportUnconfirmedConflict(awaiting.askId)
      return
    }
    receivedStatusSnapshot = true
    const reconnected = connection === 'dropped'
    const firstLive = connection === 'initial'
    connection = 'live'
    if (reconnected) reconcileLiveTurns('reconnect')
    else if (firstLive) reconcileLiveTurns('hydrate')
  }

  function reconcileLiveTurns(cause: RecoveryCause): void {
    for (const turn of conversationStore.liveTurns())
      void reconcileTurn(turn, cause)
  }

  async function reconcileTurn(
    turn: LiveTurn,
    cause: RecoveryCause,
    isAutomaticRerun = false
  ): Promise<void> {
    observeSkillTurn(turn)
    const key = recoveryKey(turn)
    if (deferToRunningRecovery(key, cause)) return
    const recovery = new AbortController()
    const state = {
      controller: recovery,
      cause,
      rerun: false,
      rerunCause: cause,
      automaticRerun: false
    }
    recoveringTurns.set(key, state)
    const deadline = setTimeout(() => {
      if (recoveringTurns.get(key)?.controller !== recovery) return
      recoveringTurns.delete(key)
      recovery.abort()
      if (!isTurnLive(turn, ownedGeneration)) return
      if (state.rerun)
        void reconcileTurn(turn, state.rerunCause, state.automaticRerun)
    }, TURN_RECOVERY_DEADLINE_MS)
    try {
      const needsRerun = await recoverTurn(
        turn,
        cause,
        ownedGeneration,
        recovery.signal
      )
      if (needsRerun && !isAutomaticRerun && !state.rerun) {
        state.rerun = true
        state.automaticRerun = true
      }
    } catch (error) {
      // `onStatus` floats this job (`void reconcileTurn(turn)`), so a rethrow
      // would land as an `unhandledrejection` the session never sees. Abort is
      // the expected end of a cancelled job; anything else is an unexpected
      // settlement or storage failure and goes through the module's reporter.
      if (!recovery.signal.aborted)
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_recovering_agent_turn'
        })
    } finally {
      clearTimeout(deadline)
      finishRecovery(key, recovery, state, turn)
    }
  }

  async function fetchSettledTurnOutcome(
    turn: LiveTurn,
    generation: number,
    signal: AbortSignal
  ): Promise<TurnOutcome> {
    let outcome = await fetchTurnOutcome(turn, signal)
    for (const ms of TURN_RECOVERY_DELAYS_MS.slice(1)) {
      if (outcome.kind !== 'streaming' || generation !== sessionGeneration)
        return outcome
      await delay(ms, { signal })
      outcome = await fetchTurnOutcome(turn, signal)
    }
    return outcome
  }

  async function reconcileSettledSnapshotTurn(turn: LiveTurn): Promise<void> {
    const generation = ownedGeneration
    const key = recoveryKey(turn)
    recoveringTurns.get(key)?.controller.abort()
    const recovery = new AbortController()
    const state: RunningRecovery = {
      controller: recovery,
      cause: 'hydrate',
      rerun: false,
      rerunCause: 'hydrate',
      automaticRerun: false
    }
    recoveringTurns.set(key, state)
    const deadline = setTimeout(
      () => recovery.abort(),
      TURN_RECOVERY_DEADLINE_MS
    )
    try {
      const outcome = await fetchSettledTurnOutcome(
        turn,
        generation,
        recovery.signal
      )
      if (generation !== sessionGeneration) return
      if (outcome.kind === 'error') {
        reportError(outcome.cause, {
          surface: 'agent',
          errorType: 'failure_recovering_agent_turn'
        })
        return
      }
      if (outcome.kind !== 'terminal') return
      conversationStore.reconcileSettledTurn(turn, outcome.parts)
    } catch (error) {
      if (!recovery.signal.aborted)
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_recovering_agent_turn'
        })
    } finally {
      clearTimeout(deadline)
      if (
        generation === sessionGeneration &&
        recoveringTurns.get(key) === state
      )
        conversationStore.reconcileSettledTurn(turn, undefined)
      finishRecovery(key, recovery, state, turn)
      recoveryPendingAskObservations.delete(key)
      recoveryThreadMissingCounts.delete(key)
    }
  }

  function deferToRunningRecovery(key: string, cause: RecoveryCause): boolean {
    const running = recoveringTurns.get(key)
    if (running === undefined) return false
    if (cause !== 'reconnect') {
      running.rerun = true
      return true
    }
    if (running.cause === 'reconnect') {
      running.rerun = true
      running.rerunCause = 'reconnect'
      return true
    }
    running.controller.abort()
    return false
  }

  function finishRecovery(
    key: string,
    recovery: AbortController,
    state: RunningRecovery,
    turn: LiveTurn
  ): void {
    if (recoveringTurns.get(key)?.controller !== recovery) return
    recoveringTurns.delete(key)
    if (state.rerun && isTurnLive(turn, ownedGeneration))
      void reconcileTurn(turn, state.rerunCause, state.automaticRerun)
  }

  async function recoverTurn(
    turn: LiveTurn,
    cause: RecoveryCause,
    generation: number,
    signal: AbortSignal
  ): Promise<boolean> {
    const key = recoveryKey(turn)
    let previousObservation = recentPendingAskObservation(key)
    let hasUnconfirmedObservation = false
    let sawStreamingObservation = false
    for (const ms of TURN_RECOVERY_DELAYS_MS) {
      await delay(ms, { signal })
      if (!isTurnLive(turn, generation)) return false
      const deliveredBeforeFetch = new Set(deliveredAsks)
      const outcome = await fetchTurnOutcome(turn, signal)
      signal.throwIfAborted()
      if (!isTurnLive(turn, generation)) return false
      const consecutiveThreadMissing = recordThreadAvailability(key, outcome)
      pruneRecoveryLedgers()
      if (isTransientMissingTurn(outcome, consecutiveThreadMissing)) {
        hasUnconfirmedObservation = true
        continue
      }
      if (settleFinishedTurn(turn, outcome)) {
        recoveryPendingAskObservations.delete(key)
        recoveryThreadMissingCounts.delete(key)
        return false
      }
      if (outcome.kind !== 'streaming') {
        hasUnconfirmedObservation = true
        continue
      }
      sawStreamingObservation = true
      const pendingAskId = streamingPendingAskId(outcome)
      const pendingAskConfirmed =
        previousObservation !== undefined &&
        previousObservation.pendingAskId === pendingAskId
      hasUnconfirmedObservation = !pendingAskConfirmed
      const deliveredSincePreviousObservation = new Set(
        [...deliveredAsks].filter(
          (askId) => !previousObservation?.deliveredAskIds.has(askId)
        )
      )
      reconcileStreamingApproval(
        turn,
        outcome,
        cause,
        pendingAskConfirmed,
        deliveredSincePreviousObservation
      )
      previousObservation = recordPendingAskObservation(
        key,
        pendingAskId,
        deliveredBeforeFetch
      )
    }
    return hasUnconfirmedObservation && sawStreamingObservation
  }

  function recentPendingAskObservation(
    key: string
  ): PendingAskObservation | undefined {
    const observation = recoveryPendingAskObservations.get(key)
    if (
      observation === undefined ||
      Date.now() - observation.observedAt <= TURN_RECOVERY_DEADLINE_MS
    )
      return observation
    recoveryPendingAskObservations.delete(key)
    return undefined
  }

  function reconcileStreamingApproval(
    turn: LiveTurn,
    outcome: TurnOutcome,
    cause: RecoveryCause,
    pendingAskConfirmed: boolean,
    deliveredDuringPoll: ReadonlySet<string>
  ): void {
    if (outcome.kind !== 'streaming') return
    if (pendingAskConfirmed)
      reconcileConfirmedApproval(turn, outcome, deliveredDuringPoll)
    if (
      !pendingAskConfirmed &&
      outcome.pendingAsk !== undefined &&
      !conversationStore.isAskShown(turn, outcome.pendingAsk.ask_id) &&
      conversationStore.hasApprovalShown(turn)
    )
      return
    restoreMissingApproval(turn, outcome.pendingAsk, cause)
  }

  function reconcileConfirmedApproval(
    turn: LiveTurn,
    outcome: Extract<TurnOutcome, { kind: 'streaming' }>,
    deliveredDuringPoll: ReadonlySet<string>
  ): void {
    if (outcome.pendingAsk)
      conversationStore.confirmAskPending(
        outcome.pendingAsk.ask_id,
        turn.threadId
      )
    const hiddenAskIds = conversationStore.reconcileApprovalParts(
      turn,
      outcome.pendingAsk?.ask_id,
      deliveredDuringPoll
    )
    for (const askId of hiddenAskIds) deliveredAsks.delete(askId)
  }

  /**
   * PM-1738: a turn parked on a tool-call approval stays `streaming` until the
   * user answers, so a socket drop that swallowed the `agent_ask` frame leaves
   * the server waiting on a card the panel never drew -- the turn reads as
   * hung and every follow-up post comes back 409. The polled row still carries
   * the unanswered ask, so re-deliver it through the store, which routes it to
   * the same transport the lost frame would have reached, and mirror the one
   * other thing the socket branch does with an ask.
   *
   * Reported at `error` only after a reconnect, where the frame really is
   * gone. A hydrate's poll can instead be racing a broadcast the server had
   * not published when its history fetch went out, so that reads as a warning.
   */
  function restoreMissingApproval(
    turn: LiveTurn,
    pendingAsk: PendingAsk | undefined,
    cause: RecoveryCause
  ): void {
    if (!pendingAsk) return
    if (deliveredAsks.has(pendingAsk.ask_id)) return
    if (
      conversationStore.submittedAskAnswer(pendingAsk.ask_id) !== undefined ||
      answeringAskIds.value.has(pendingAsk.ask_id)
    )
      return
    if (conversationStore.isAskRetired(pendingAsk.ask_id, turn.threadId)) return
    if (conversationStore.isAskShown(turn, pendingAsk.ask_id)) return
    const wasDeliveredBefore = observedDeliveredAsks.has(pendingAsk.ask_id)
    conversationStore.ingest({
      type: 'agent_ask',
      data: {
        ...pendingAsk,
        thread_id: turn.threadId,
        message_id: turn.messageId
      }
    })
    if (!conversationStore.isAskShown(turn, pendingAsk.ask_id)) return
    recordDeliveredAsk(pendingAsk.ask_id)
    if (!wasDeliveredBefore)
      reportRestoredApproval(turn, pendingAsk.ask_id, cause)
  }

  /**
   * The server writes the ask row before it publishes the frame, so a poll
   * can restore an ask whose broadcast is merely in flight. Only a reconnect
   * claims a frame was lost, and only once its own broadcast has had a grace
   * window to turn up -- `withdrawLateAskReport` cancels this when it does.
   * A hydrate races the same way but never had a dropped socket to blame, so
   * it files as a warning immediately.
   */
  function reportRestoredApproval(
    turn: LiveTurn,
    askId: string,
    cause: RecoveryCause
  ): void {
    const lostFrame = cause === 'reconnect' || connection === 'dropped'
    if (!lostFrame) {
      sendRestoredApprovalReport(turn, askId, cause, 'warning')
      return
    }
    const key = lateAskReportKey(turn.threadId, askId)
    withdrawLateAskReport(turn.threadId, askId)
    lateAskReports.set(key, {
      threadId: turn.threadId,
      messageId: turn.messageId,
      timer: setTimeout(() => {
        lateAskReports.delete(key)
        sendRestoredApprovalReport(turn, askId, cause, 'error')
      }, LATE_ASK_FRAME_GRACE_MS)
    })
  }

  /**
   * Routes an inbound `agent_ask`. One already in the ledger is an ask
   * recovery has supplied, or one the user has finished with; dropping it on
   * the id rather than on the rendered parts is what stops a frame delayed
   * past its own resolution from drawing a card over a resumed reply.
   *
   * A frame is only ledgered once its card is actually on screen. `ingest`
   * has nowhere to route one that arrives before its turn is in memory -- the
   * window between subscribing and the first history fetch landing -- and
   * ledgering a frame the store dropped would convince recovery the ask had
   * been delivered, leaving the panel with no card at all.
   */
  function deliverAsk(
    event: Extract<AgentWsEvent, { type: 'agent_ask' }>
  ): void {
    const askId = event.data.ask_id
    if (conversationStore.isAskRetired(askId, event.data.thread_id)) {
      withdrawLateAskReport(event.data.thread_id, askId)
      return
    }
    const turn = {
      threadId: event.data.thread_id,
      messageId: toTurnId(event.data.message_id)
    }
    if (
      deliveredAsks.has(askId) &&
      (conversationStore.isAskShown(turn, askId) ||
        conversationStore.submittedAskAnswer(askId) !== undefined)
    ) {
      withdrawLateAskReport(event.data.thread_id, askId)
      return
    }
    conversationStore.ingest(event)
    withdrawLateAskReport(event.data.thread_id, askId)
    if (conversationStore.isAskShown(turn, askId)) recordDeliveredAsk(askId)
  }

  function withdrawLateAskReport(threadId: string, askId: string): void {
    const key = lateAskReportKey(threadId, askId)
    const scheduled = lateAskReports.get(key)
    if (scheduled === undefined) return
    clearTimeout(scheduled.timer)
    lateAskReports.delete(key)
  }

  function sendRestoredApprovalReport(
    turn: LiveTurn,
    askId: string,
    cause: RecoveryCause,
    level: 'error' | 'warning'
  ): void {
    reportError(
      new Error('Agent approval ask was missing from the panel when polled'),
      {
        surface: 'agent',
        errorType: 'failure_delivering_agent_approval_ask',
        level,
        tags: {
          feature_area: 'agent',
          operation: 'recovery',
          recovery_cause: cause
        },
        context: { threadId: turn.threadId, messageId: turn.messageId, askId }
      }
    )
  }

  function isTurnLive(turn: LiveTurn, generation: number): boolean {
    return (
      generation === sessionGeneration &&
      conversationStore
        .liveTurns()
        .some(
          (live) =>
            live.threadId === turn.threadId && live.messageId === turn.messageId
        )
    )
  }

  function markRecoveredSkillUse(
    turn: LiveTurn,
    parts: Extract<TurnOutcome, { kind: 'terminal' }>['parts']
  ): void {
    if (
      !parts?.some((part) => part.type === 'tool' && part.name === 'load_skill')
    )
      return
    observeSkillTurn(turn)
    const usage = skillTurnUsage.get(recoveryKey(turn))
    if (usage) usage.used = true
  }

  function settleTerminalTurn(
    turn: LiveTurn,
    parts: Extract<TurnOutcome, { kind: 'terminal' }>['parts'],
    ending: Extract<TurnOutcome, { kind: 'terminal' }>['ending']
  ): void {
    markRecoveredSkillUse(turn, parts)
    finishSkillTurn(turn)
    conversationStore.settleTurn(turn, parts, ending)
    markStoppedTurnReady(turn)
  }

  function settleFinishedTurn(turn: LiveTurn, outcome: TurnOutcome): boolean {
    switch (outcome.kind) {
      case 'terminal':
        settleTerminalTurn(turn, outcome.parts, outcome.ending)
        return true
      case 'thread-missing':
        forgetDeletedThread(turn)
        return true
      case 'streaming':
      case 'error':
        return false
      default: {
        const unhandled: never = outcome
        return unhandled
      }
    }
  }

  function markStoppedTurnReady(turn: LiveTurn): void {
    if (
      promptEditState.value.phase !== 'stopping' ||
      turn.messageId !== promptEditState.value.turnId ||
      turn.threadId !== conversationStore.threadId
    )
      return
    promptEditState.value = {
      phase: 'ready',
      turnId: promptEditState.value.turnId
    }
  }

  async function fetchTurnOutcome(
    turn: LiveTurn,
    signal: AbortSignal
  ): Promise<TurnOutcome> {
    try {
      const history = await rest.getMessages(turn.threadId, { signal })
      const anchor = history.find(
        (entry) => entry.role === 'assistant' && entry.id === turn.messageId
      )
      if (!anchor)
        return { kind: 'error', cause: new Error('turn row is not visible') }
      const rows = history
        .filter(
          (entry) =>
            entry.role === 'assistant' && entry.turn_id === anchor.turn_id
        )
        .sort((a, b) => a.seq - b.seq)
      const latest = rows.at(-1)
      if (latest && !isTerminalTurnStatus(latest.status))
        return {
          kind: 'streaming',
          pendingAsk: rows.findLast(
            (row) =>
              !isTerminalTurnStatus(row.status) && row.pending_ask !== undefined
          )?.pending_ask
        }
      return {
        kind: 'terminal',
        parts: terminalRecoveryParts(rows),
        ending: rows.at(-1)?.status === 'complete' ? 'completed' : 'failed'
      }
    } catch (error) {
      if (signal.aborted) throw error
      return turnOutcomeFromError(error)
    }
  }

  function forgetDeletedThread(turn: LiveTurn): void {
    skillTurnUsage.delete(recoveryKey(turn))
    recoveryPendingAskObservations.delete(recoveryKey(turn))
    recoveryThreadMissingCounts.delete(recoveryKey(turn))
    clearLateAskReports(turn.threadId)
    if (conversationStore.threadId !== turn.threadId) {
      conversationStore.settleTurn(turn, undefined, 'failed')
      return
    }
    loadGeneration++
    conversationStore.reset()
    pruneSkillTurns()
    onThreadActivated?.(null)
    forgetBinding()
    localStorage.removeItem(threadStorageKey)
  }

  const isSending = computed(() => sending.value)
  const editableTurnId = computed(() =>
    promptEditState.value.phase === 'ready'
      ? promptEditState.value.turnId
      : null
  )

  function bindWorkflow(workflowId: string): void {
    boundWorkflowId.value = workflowId
    rememberedWorkflowId = workflowId
  }

  return {
    boundWorkflowId: computed(() => boundWorkflowId.value),
    bindWorkflow,
    reportWorkflowBound,
    isSending,
    isTranscriptReady: computed(
      () =>
        readyThreadId.value !== null &&
        readyThreadId.value === conversationStore.threadId
    ),
    editableTurnId,
    start,
    stop,
    sendMessage,
    stopTurn,
    answerAsk,
    answeringAskIds: computed(() => answeringAskIds.value),
    newChat,
    loadThread,
    entries: computed(() => conversationStore.entries),
    status: computed(() => conversationStore.status),
    isStreaming: computed(() => conversationStore.isStreaming),
    notices: computed(() => notices.value),
    threadId: computed(() => conversationStore.threadId)
  }
}
