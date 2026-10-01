import { delay } from 'es-toolkit'
import { computed, ref, watch } from 'vue'
import { ZodError } from 'zod'

import { i18n } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  AgentErrorClass,
  AgentErrorMetadata,
  AgentStopClickedMetadata,
  AgentStopMethod,
  AgentThreadStartSource,
  AgentWorkflowBindSource
} from '@/platform/telemetry/types'
import {
  clearLegacyAgentStorage,
  getStorageIdentity,
  getStorageScope
} from '@/platform/workflow/persistence/base/storageIO'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { createUuidv4 } from '@/utils/uuid'
import type {
  AgentActiveTabData,
  AgentMessages,
  AgentTurnAccepted,
  AgentWsEvent,
  TurnId
} from '../../schemas/agentApiSchema'
import {
  isAgentEvent,
  parseAgentWsEvent,
  toTurnId,
  zAgentAdmissionError,
  zDisownedWorkflowError
} from '../../schemas/agentApiSchema'
import {
  AgentApiError,
  AgentResponseUnreadableError
} from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftSnapshot,
  OpenTabsSnapshot,
  PostMessageInput
} from '../../services/agent/agentRestClient'
import type { AssistantMessage } from '../../services/agent/agentMessageParts'
import { normalizeAgentTranscript } from '../../services/agent/agentTranscript'
import type { LiveTurn } from '../../stores/agent/agentConversationStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import type { WorkflowReference } from '../../types/workflowReference'
import { serializeWorkflowReferences } from '../../utils/workflowReferenceText'

export interface AgentEventSource {
  subscribe(listener: (raw: unknown) => void): () => void
  onStatus?(listener: (live: boolean) => void): () => void
}

interface SessionNotice {
  level: 'error'
  text: string
}

interface SentAttachment {
  ref: string
  name: string
  previewUrl?: string
}

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
  onThreadActivated?: (threadId: string | null) => void
  onAskResolved?: (askId: string) => void
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

/**
 * After a reconnect the server may still be finishing the turn, and its
 * terminal event may or may not reach the new socket. Poll the persisted row
 * with backoff; once the schedule is exhausted the socket alone is trusted.
 */
const TURN_RECOVERY_DELAYS_MS = [0, 1000, 2000, 4000, 8000, 16000]
/** Upper bound on one recovery job, including any history fetch still in flight. */
const TURN_RECOVERY_DEADLINE_MS = 60_000

type TurnOutcome =
  | { kind: 'terminal'; parts: AssistantMessage['parts'] | undefined }
  | { kind: 'thread-missing' }
  | { kind: 'streaming' }
  | { kind: 'error'; message: string }

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
  return {
    kind: 'error',
    message: error instanceof Error ? error.message : String(error)
  }
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
  overrides: { retryable?: boolean; turnAccepted?: boolean } = {}
): void {
  useTelemetry()?.trackAgentError({
    error_class: errorClass,
    failure_stage: stage,
    retryable: overrides.retryable ?? stage === 'pre_acceptance',
    turn_accepted: overrides.turnAccepted ?? stage === 'post_acceptance',
    ui_treatment: uiTreatment
  })
}

/**
 * Statuses the answer endpoint uses to say this ask will never be answerable
 * by this client: 409 once it is resolved, 403 for a thread/workspace or
 * ownership mismatch, 404 once the ask or its thread is gone. Retrying any of
 * them just reproduces it, so the card is dropped rather than re-offered. 5xx
 * is deliberately absent — the server documents it as retryable.
 */
const TERMINAL_ANSWER_STATUSES = new Set([403, 404, 409])

/**
 * PM-1658: backoff before re-driving a consent answer. The server documents
 * 5xx here as retryable and re-drives the STORED selection, so resending the
 * same answer is always safe and is the only recovery that cannot turn into a
 * contradictory second choice. One retry only: the card is disabled for the
 * whole sequence, which with ANSWER_ASK_TIMEOUT_MS keeps the worst case under
 * the shared 60s request deadline it replaces.
 */
const ANSWER_RETRY_BACKOFF_MS = [300]

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
interface SendInFlight {
  owner: string | null
}

let sendInFlight: SendInFlight | null = null
let stopPendingAck: { method: AgentStopMethod | undefined } | null = null

function hasCurrentOwnerSend(): boolean {
  return sendInFlight?.owner === getStorageIdentity()
}

function consumeStopPendingAck() {
  const pending = stopPendingAck
  stopPendingAck = null
  return pending
}

function parseAdmissionError(error: unknown) {
  if (!(error instanceof AgentApiError)) return undefined
  const parsed = zAgentAdmissionError.safeParse(error.body)
  if (!parsed.success) return undefined
  const expectedStatus =
    parsed.data.error.type === 'PAYMENT_REQUIRED' ? 402 : 503
  if (error.status !== expectedStatus) return undefined
  return { ...parsed.data.error, retryAfterSeconds: error.retryAfterSeconds }
}

function disownsWorkflow(error: unknown): boolean {
  return (
    error instanceof AgentApiError &&
    error.status === 403 &&
    zDisownedWorkflowError.safeParse(error.body).success
  )
}

function isCurrentStorageContinuation(
  generation: number,
  currentGeneration: number,
  owner: string | null
): boolean {
  return generation === currentGeneration && owner === getStorageIdentity()
}

export function useAgentSession(deps: AgentSessionDeps) {
  const {
    rest,
    events,
    onThreadStarted,
    onThreadActivated,
    onAskResolved,
    workflow
  } = deps
  clearLegacyAgentStorage()

  function readStoredThread(): string | null {
    const scope = getStorageScope()
    return scope ? localStorage.getItem(StorageKeys.agentThread(scope)) : null
  }

  function writeStoredThread(threadId: string): void {
    const scope = getStorageScope()
    if (scope) localStorage.setItem(StorageKeys.agentThread(scope), threadId)
  }

  function removeStoredThread(): void {
    const scope = getStorageScope()
    if (scope) localStorage.removeItem(StorageKeys.agentThread(scope))
  }

  const conversationStore = useAgentConversationStore()
  const bindingStore = useAgentWorkflowTabBindingStore()
  /**
   * The workflow the session is bound to (set on turn ack or an active-tab
   * switch, cleared by newChat/loadThread) - the CRDT follower's subscribe
   * target.
   */
  const boundWorkflowId = ref<string | null>(rememberedWorkflowId)

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

  function nextLocalErrorId(): TurnId {
    return toTurnId(`local-error-${createUuidv4()}`)
  }

  let unsubscribe: (() => void) | null = null
  let unsubscribeStatus: (() => void) | null = null
  let ownedGeneration = 0
  let connection: SocketConnection = 'initial'
  const recoveringTurns = new Map<string, AbortController>()
  let observedStorageOwner = getStorageIdentity()

  function pushError(text: string): void {
    notices.value.push({ level: 'error', text })
  }

  const malformedStreamReports = new Map<TurnId | null, boolean>()

  function transitionStorageOwner(currentOwner = getStorageIdentity()): void {
    if (currentOwner === observedStorageOwner) return
    observedStorageOwner = currentOwner
    loadGeneration++
    readyThreadId.value = null
    promptEditState.value = { phase: 'idle' }
    conversationStore.resetForStorageOwnerTransition()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    notices.value = []
    pendingThreadSource.value = 'first_open'
    reportedWorkflowBind = null
    pendingWorkflowBind = null
    turnStartedAt.clear()
    sendInFlight = null
    stopPendingAck = null
    sending.value = false
    connection = 'initial'
    malformedStreamReports.clear()
  }

  let stopStorageOwnerWatcher: (() => void) | null = null

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

  function initializeWorkflowContext(hasThread: boolean): void {
    workflow?.initialize?.(hasThread)
    // The binding only outlives a remount together with its thread: a page
    // with no surviving thread has no resumed turn the binding could serve.
    if (conversationStore.threadId === null && readStoredThread() === null) {
      rememberedWorkflowId = null
      boundWorkflowId.value = null
    }
  }

  function start({ restore = true }: { restore?: boolean } = {}): void {
    stopped = false
    transitionStorageOwner()
    stopStorageOwnerWatcher ??= watch(
      getStorageIdentity,
      transitionStorageOwner,
      { flush: 'sync' }
    )
    readyThreadId.value = null
    ownedGeneration = ++sessionGeneration
    connection = 'initial'
    const surviving = conversationStore.threadId
    const stored =
      conversationStore.messages.length === 0 ? readStoredThread() : null
    const initialThreadId = surviving ?? stored
    initializeWorkflowContext(initialThreadId !== null)
    unsubscribe = events.subscribe(onRaw)
    if (events.onStatus) unsubscribeStatus = events.onStatus(onStatus)
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
    const ready = await hydrateFromServer(
      initialThreadId,
      isCurrent,
      stashedTurn
    )
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

  async function hydrateFromServer(
    threadId: string,
    isCurrent: () => boolean = () => true,
    stashedTurn = false
  ): Promise<boolean> {
    const buffer = armHydration(threadId)
    try {
      const history = await rest.getMessages(threadId)
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      conversationStore.hydrate(history)
      rememberSnapshotTurn(conversationStore.activeTurnId)
      reconcileLiveTurns()
      readyThreadId.value = threadId
      drainHydration(buffer)
      const workflowReady = await workflow?.restored?.(
        conversationStore.latestWorkflowId,
        isCurrent
      )
      if (workflowReady === false) return false
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      return true
    } catch (error) {
      return handleHistoryLoadError(error, threadId, isCurrent, stashedTurn)
    } finally {
      drainHydration(buffer)
    }
  }

  function handleHistoryLoadError(
    error: unknown,
    threadId: string,
    isCurrent: () => boolean,
    stashedTurn: boolean
  ): false {
    if (!isCurrent()) return false
    if (error instanceof AgentApiError && error.status === 404) {
      if (conversationStore.threadId === threadId)
        conversationStore.setThreadId(null)
      if (readStoredThread() === threadId) removeStoredThread()
      return false
    }
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_history_load_failed'
    })
    pushError(error instanceof Error ? error.message : String(error))
    trackAgentError('history_load_failed', 'pre_acceptance', 'error_overlay', {
      retryable: isRetryableRequestFailure(error, false),
      turnAccepted: stashedTurn
    })
    return false
  }

  function stop(): void {
    stopped = true
    readyThreadId.value = null
    unsubscribe?.()
    unsubscribeStatus?.()
    unsubscribe = null
    unsubscribeStatus = null
    for (const recovery of recoveringTurns.values()) recovery.abort()
    recoveringTurns.clear()
    stopStorageOwnerWatcher?.()
    stopStorageOwnerWatcher = null
    const stoppedGeneration = ownedGeneration
    queueMicrotask(() => {
      if (stoppedGeneration !== sessionGeneration) return
      loadGeneration++
      turnStartedAt.clear()
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

  function postTurn(
    threadId: string,
    text: string,
    origin: TurnOrigin,
    wfContext: WorkflowTurnContext | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    selectionWorkflowId?: () => string | undefined,
    clientMessageId?: string
  ): Promise<AgentTurnAccepted> {
    const input = buildPostInput(
      threadId,
      text,
      origin,
      wfContext,
      attachments,
      tags,
      workflowReferences,
      selectionWorkflowId,
      clientMessageId
    )
    if (wfContext?.id === undefined) return rest.postMessage(threadId, input)
    return rest.postMessage(threadId, { ...input, workflowId: wfContext.id })
  }

  function buildPostInput(
    threadId: string,
    text: string,
    origin: TurnOrigin,
    wfContext: WorkflowTurnContext | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    selectionWorkflowId?: () => string | undefined,
    clientMessageId?: string
  ): PostMessageInput {
    const draft = workflow?.draft?.(origin)
    const unboundTarget = isUnboundTarget(wfContext, boundWorkflowId.value)
    // Resolved here rather than at the call site: `buildPostInput` runs after
    // `prepareWorkflow()`, so a tab whose cloud id was still unresolved on
    // mount has one by now (QAF-19).
    const selectedWorkflowId = selectionWorkflowId?.()
    return {
      content: serializeWorkflowReferences(text, workflowReferences ?? []),
      tabs: workflow?.tabs?.(origin),
      workflowReferences: serializeReferencedWorkflows(
        workflowReferences,
        wfContext?.id
      ),
      selection: selectedNodes(tags, selectedWorkflowId),
      attachments: attachments?.map((attachment) => attachment.ref),
      // Carried through untouched so the server can echo it onto
      // agent_turn_started: it is the same id this send reports on its own
      // app:agent_message_sent event, and the only value that can appear on both
      // sides of the message -> turn step.
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

  // current_tab_unbound's own contract (see its generated doc comment) is
  // a tab-level fact: this tab has no cloud id yet. wfContext with no id
  // is exactly that (a saved tab whose cloud id failed to resolve makes
  // wfContext undefined entirely instead - see targetWorkflowTurnContext).
  //
  // boundWorkflowId === null narrows WHEN we assert that fact, and is a
  // client-side policy choice, not part of the field's own meaning: the
  // server has no way yet to tell "this thread's remembered workflow is
  // itself my own prior unbound mint for this same tab" apart from "an
  // unrelated workflow from a different tab" (see
  // TestPostMessageUnboundCurrentTabMintsInsteadOfReusingTheThreadWorkflow
  // in the agent service), so asserting the flag on every turn a still-
  // unbound tab is asked about would mint a fresh, contentless workflow
  // each time. Once any turn this session has bound a workflow, that
  // binding (or the thread's own remembered workflow) is a safer target
  // than minting again. Telling the server this is a selected-but-unbound
  // tab, not "nothing selected", is what keeps the seed from telling the
  // model no workflow is selected - see PM-1429/PM-1430.
  function isUnboundTarget(
    wfContext: WorkflowTurnContext | undefined,
    boundWorkflowId: string | null
  ): boolean {
    return (
      wfContext !== undefined &&
      wfContext.id === undefined &&
      boundWorkflowId === null
    )
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
      onThreadStarted?.(pendingThreadSource.value)
      pendingThreadSource.value = null
    }
  }

  function acceptTurn(
    ack: AgentTurnAccepted,
    text: string,
    wfContext: WorkflowTurnContext | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[]
  ): void {
    const startsThread = conversationStore.threadId === null
    conversationStore.setThreadId(ack.thread_id)
    onThreadActivated?.(ack.thread_id)
    writeStoredThread(ack.thread_id)
    if (ack.workflow_id !== undefined) {
      const boundAtAck = boundWorkflowId.value
      bindWorkflow(ack.workflow_id)
      const shouldAdopt =
        wfContext?.id !== undefined ||
        (ack.workflow_id !== boundAtAck &&
          bindingStore.tabPathFor(ack.workflow_id) === undefined)
      if (shouldAdopt) workflow?.adopted(ack.workflow_id, wfContext, boundAtAck)
    }
    const turnId = toTurnId(ack.message_id)
    conversationStore.recordUser(
      turnId,
      text,
      attachments?.map(({ name, previewUrl, ref }) => ({
        name,
        previewUrl,
        ref
      })),
      tags?.map((tag) => `${tag.title} #${tag.id}`),
      workflowReferences
    )
    conversationStore.startTurn(turnId)
    readyThreadId.value = ack.thread_id
    recordTurnStarted(turnId, startsThread)
    const pendingStop = consumeStopPendingAck()
    if (pendingStop !== null) void stopTurn(pendingStop.method)
  }

  function recordSendError(
    error: unknown,
    text: string,
    accepted: boolean
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
    const message =
      error instanceof AgentApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error)
    conversationStore.recordFailedSend(
      nextLocalErrorId(),
      text,
      `${i18n.global.t('agent.sendFailed')}: ${message}`
    )
    const turnAccepted = accepted || isUnreadableAckFailure(error)
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_send_message_failed'
    })
    trackAgentError(
      'request_failed',
      turnAccepted ? 'post_acceptance' : 'pre_acceptance',
      'inline_notice',
      { retryable: isRetryableRequestFailure(error, turnAccepted) }
    )
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
    error: unknown,
    storageOwnerAtSend: string | null
  ): void {
    if (
      sent?.id === undefined ||
      !disownsWorkflow(error) ||
      storageOwnerAtSend !== getStorageIdentity()
    )
      return
    bindingStore.unbindWorkflow(sent.id)
    workflow?.disowned?.(sent.id)
    if (boundWorkflowId.value === sent.id) boundWorkflowId.value = null
    if (rememberedWorkflowId === sent.id) rememberedWorkflowId = null
  }

  async function performSend(
    text: string,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    selectionWorkflowId?: () => string | undefined,
    clientMessageId?: string
  ): Promise<boolean> {
    const generation = loadGeneration
    const storageOwnerAtSend = getStorageIdentity()
    const isCurrentSend = () =>
      isCurrentStorageContinuation(
        generation,
        loadGeneration,
        storageOwnerAtSend
      )
    const threadAtSend = conversationStore.threadId ?? 'new'
    const originContext = workflow?.current()
    const origin: TurnOrigin =
      originContext === undefined ? null : { tabPath: originContext.tabPath }
    let sentContext: WorkflowTurnContext | undefined
    let accepted = false
    try {
      await prepareWorkflow()
      if (!isCurrentSend()) return false
      const wfContext = workflow?.current(origin)
      if (workflowTargetChanged(originContext, wfContext)) {
        recordUnavailableTarget(text)
        return false
      }
      sentContext = wfContext
      const ack = await postTurn(
        threadAtSend,
        text,
        origin,
        wfContext,
        attachments,
        tags,
        workflowReferences,
        selectionWorkflowId,
        clientMessageId
      )
      accepted = true
      if (!isCurrentSend()) return false
      acceptTurn(ack, text, wfContext, attachments, tags, workflowReferences)
      return true
    } catch (error) {
      // Before the generation guard: same-owner newChat()/loadThread() must
      // still release a refused persisted id. The captured-owner guard inside
      // release prevents that cleanup from crossing an identity transition.
      releaseDisownedWorkflow(sentContext, error, storageOwnerAtSend)
      if (!isCurrentSend()) return false
      recordSendError(error, text, accepted)
      return false
    }
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
    clientMessageId?: string
  ): Promise<boolean> {
    transitionStorageOwner()
    if (sending.value) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        i18n.global.t('agent.sendBusy')
      )
      return false
    }
    promptEditState.value = { phase: 'idle' }
    const sendSlot = {
      owner: getStorageIdentity()
    }
    sending.value = true
    sendInFlight = sendSlot
    stopPendingAck = null
    try {
      return await performSend(
        text,
        attachments,
        tags,
        workflowReferences,
        selectionWorkflowId,
        clientMessageId
      )
    } finally {
      if (sendInFlight === sendSlot) {
        sending.value = false
        sendInFlight = null
      }
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
    const generation = loadGeneration
    const storageOwnerAtStop = getStorageIdentity()
    const isCurrentStop = () =>
      isCurrentStorageContinuation(
        generation,
        loadGeneration,
        storageOwnerAtStop
      )
    const threadId = conversationStore.threadId
    const turnId = conversationStore.activeTurnId
    if (threadId === null || turnId === null) {
      // The POST has not acked yet; remember the intent and cancel on ack.
      // sendInFlight, not this instance's sending: the panel that posted may
      // have been remounted, and the stop arrives through the new instance.
      if (hasCurrentOwnerSend()) stopPendingAck = { method }
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
      if (!isCurrentStop()) return
      trackCommittedStop(stopMetadata)
    } catch (error) {
      if (!isCurrentStop()) return
      await handleStopFailure(error, turnId)
    }
  }

  function handleAskFailure(
    error: unknown,
    askId: string,
    currentThreadId: string
  ): false {
    // A resolution frame can land while this request is still out, and it
    // retires the card on the way through. The ask is settled and gone, so
    // whatever this rejection says about delivery is no longer news the user
    // can act on — any mismatch worth telling them about has already been
    // raised by reportSupersededAnswer.
    if (!answeringAskIds.value.has(askId)) return false
    if (
      error instanceof AgentApiError &&
      TERMINAL_ANSWER_STATUSES.has(error.status)
    ) {
      // A 409 is the ordinary double-click, and the ask really is resolved,
      // so it needs neither telemetry nor a notice. The rest mean this
      // client could never have answered, which the user has to be told
      // about or the card simply vanishes as though it had worked.
      if (error.status !== 409) {
        reportError(error, {
          surface: 'agent',
          errorType: 'agent_ask_answer_refused'
        })
        trackAgentError(
          'ask_answer_failed',
          'post_acceptance',
          'error_overlay',
          {
            retryable: isRetryableRequestFailure(error, false)
          }
        )
        pushError(i18n.global.t('agent.runApproval.answerFailed'))
      }
      conversationStore.retireAsk(askId, currentThreadId)
      return false
    }
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_ask_answer_failed'
    })
    trackAgentError('ask_answer_failed', 'post_acceptance', 'error_overlay', {
      retryable: isRetryableRequestFailure(error, false)
    })
    // Every re-drive above has been spent. The card cannot simply go back
    // into service: the server CASes an answer onto the row BEFORE it wakes
    // the turn and reports 500 for the wake alone, so this may already have
    // authorized the run, and it answers any later click by replaying THIS
    // selection while the card disappears as though the new one had taken
    // effect. On a spend authorization that is the wrong way to be wrong, so
    // retire the card and say the outcome is unknown rather than show a raw
    // transport string next to a card that is about to vanish.
    conversationStore.retireAsk(askId, currentThreadId)
    pushError(i18n.global.t('agent.runApproval.answerUncertain'))
    return false
  }

  async function answerAsk(
    askId: string,
    selection: 'run' | 'cancel'
  ): Promise<boolean> {
    const generation = loadGeneration
    const storageOwnerAtAnswer = getStorageIdentity()
    const isCurrentAnswer = () =>
      isCurrentStorageContinuation(
        generation,
        loadGeneration,
        storageOwnerAtAnswer
      )
    const currentThreadId = conversationStore.threadId
    if (currentThreadId === null) {
      // PM-1658: the card is on screen, so a click on it is never a no-op.
      reportError(
        new Error('run approval answered with no thread to send on'),
        { surface: 'agent', errorType: 'agent_ask_answer_unroutable' }
      )
      pushError(i18n.global.t('agent.runApproval.answerFailed'))
      // Nothing can ever answer this card, so retire it rather than let every
      // further click raise another toast and another telemetry event.
      conversationStore.retireAsk(askId)
      return false
    }
    // PM-1658: deliberately NOT gated on an active turn. The endpoint is keyed
    // by thread and ask alone — it never looks a turn up — and the server
    // parks a run approval for days, so a card can still be answered long
    // after the turn that raised it stopped streaming to this client.
    if (answeringAskIds.value.has(askId)) return false
    conversationStore.recordAskSelection(askId, selection)
    conversationStore.setAskAnswering(askId, true)
    try {
      const sent = await sendAnswer(
        currentThreadId,
        askId,
        selection,
        isCurrentAnswer
      )
      if (!sent) return false
      if (!isCurrentAnswer()) return false
      conversationStore.commitAsk(askId, currentThreadId)
      return true
    } catch (error) {
      if (!isCurrentAnswer()) return false
      return handleAskFailure(error, askId, currentThreadId)
    }
  }

  /**
   * PM-1658: the server commits the FIRST answer an ask receives and takes
   * every later one with 202 while replaying the stored selection, so another
   * tab — or this one before a reload — can decide a card this client also
   * answered. The resolution frame names the selection that actually won, so
   * when it disagrees with ours, the card is about to disappear on someone
   * else's choice and the user has to be told rather than left reading the
   * dismissal as their own.
   */
  function reportSupersededAnswer(
    askId: string,
    settled: string[] | null
  ): void {
    const submitted = conversationStore.submittedAskSelection(askId)
    if (
      submitted === undefined ||
      settled === null ||
      settled.length === 0 ||
      settled.includes(submitted)
    )
      return
    reportError(
      new Error(
        `run approval resolved as ${settled.join(',')}, not ${submitted}`
      ),
      { surface: 'agent', errorType: 'agent_ask_answer_superseded' }
    )
    pushError(i18n.global.t('agent.runApproval.answerSuperseded'))
  }

  async function sendAnswer(
    threadId: string,
    askId: string,
    selection: 'run' | 'cancel',
    isCurrentAnswer: () => boolean
  ): Promise<boolean> {
    for (let attempt = 0; ; attempt++) {
      if (!isCurrentAnswer()) return false
      try {
        await rest.answerAsk(threadId, askId, [selection])
        return true
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

  function newChat(
    source?: Exclude<AgentSessionThreadStartSource, 'first_open'>
  ): void {
    readyThreadId.value = null
    loadGeneration++
    promptEditState.value = { phase: 'idle' }
    conversationStore.stashActiveTurn()
    conversationStore.reset()
    onThreadActivated?.(null)
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    pendingWorkflowBind = null
    malformedStreamReports.clear()
    removeStoredThread()
    pendingThreadSource.value = source ?? null
  }

  function listThreads() {
    return rest.listThreads()
  }

  async function loadThread(
    threadId: string,
    isNavigationCurrent: () => boolean = () => true
  ): Promise<boolean> {
    readyThreadId.value = null
    const generation = ++loadGeneration
    promptEditState.value = { phase: 'idle' }
    const isCurrent = () =>
      generation === loadGeneration &&
      ownedGeneration === sessionGeneration &&
      isNavigationCurrent()
    const stashedTurn = conversationStore.activeTurnId !== null
    conversationStore.stashActiveTurn()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    pendingWorkflowBind = null
    malformedStreamReports.clear()
    conversationStore.setThreadId(threadId)
    const hydrated = await hydrateFromServer(threadId, isCurrent, stashedTurn)
    if (hydrated && isCurrent()) {
      writeStoredThread(threadId)
      onThreadActivated?.(threadId)
      conversationStore.resumeBackgroundTurn()
    }
    return hydrated && isCurrent()
  }

  function malformedEventTurnId(raw: object): TurnId | undefined {
    if (!('data' in raw) || typeof raw.data !== 'object' || raw.data === null)
      return undefined
    if (!('message_id' in raw.data)) return undefined
    const messageId = raw.data.message_id
    return typeof messageId === 'string' ? toTurnId(messageId) : undefined
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
    console.warn('[agent] dropping malformed agent event', error)
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

  function handleAgentEvent(event: AgentWsEvent): void {
    if (heldForHydration(event)) return
    observeLiveDelivery(event)
    if (event.type === 'agent_ask_resolved') {
      reportSupersededAnswer(event.data.ask_id, event.data.selected)
      // Not just un-busying it: `ingest` below routes this frame through the
      // owning turn's transport, and the turn is gone in exactly the case that
      // matters, so on its own it would re-enable a card it cannot remove.
      conversationStore.retireAsk(event.data.ask_id, event.data.thread_id)
      onAskResolved?.(event.data.ask_id)
    }
    conversationStore.ingest(event)
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
    handleAgentEvent(parsed.data)
  }

  function onStatus(live: boolean): void {
    if (!live) {
      connection = 'dropped'
      return
    }
    const reconnected = connection === 'dropped'
    connection = 'live'
    if (!reconnected) return
    reconcileLiveTurns()
  }

  function reconcileLiveTurns(): void {
    const turns = conversationStore
      .liveTurns()
      .filter((turn) => !recoveringTurns.has(recoveryKey(turn)))
    for (const turn of turns) void reconcileTurn(turn)
  }

  async function reconcileTurn(turn: LiveTurn): Promise<void> {
    const key = recoveryKey(turn)
    const recovery = new AbortController()
    recoveringTurns.set(key, recovery)
    const deadline = setTimeout(
      () => recovery.abort(),
      TURN_RECOVERY_DEADLINE_MS
    )
    try {
      await recoverTurn(turn, ownedGeneration, recovery.signal)
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
      if (recoveringTurns.get(key) === recovery) recoveringTurns.delete(key)
    }
  }

  async function recoverTurn(
    turn: LiveTurn,
    generation: number,
    signal: AbortSignal
  ): Promise<void> {
    let consecutiveThreadMissing = 0
    for (const ms of TURN_RECOVERY_DELAYS_MS) {
      await delay(ms, { signal })
      if (!isTurnLive(turn, generation)) return
      const outcome = await fetchTurnOutcome(turn, signal)
      if (!isTurnLive(turn, generation)) return
      consecutiveThreadMissing =
        outcome.kind === 'thread-missing' ? consecutiveThreadMissing + 1 : 0
      if (outcome.kind === 'thread-missing' && consecutiveThreadMissing < 2)
        continue
      if (settleFinishedTurn(turn, outcome)) return
    }
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

  function settleFinishedTurn(turn: LiveTurn, outcome: TurnOutcome): boolean {
    switch (outcome.kind) {
      case 'terminal':
        conversationStore.settleTurn(turn, outcome.parts)
        markStoppedTurnReady(turn)
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
      if (!anchor) return { kind: 'streaming' }
      const rows = history
        .filter(
          (entry) =>
            entry.role === 'assistant' && entry.turn_id === anchor.turn_id
        )
        .sort((a, b) => a.seq - b.seq)
      if (rows.some((row) => !isTerminalTurnStatus(row.status)))
        return { kind: 'streaming' }
      return {
        kind: 'terminal',
        parts: terminalRecoveryParts(rows)
      }
    } catch (error) {
      if (signal.aborted) throw error
      return turnOutcomeFromError(error)
    }
  }

  function forgetDeletedThread(turn: LiveTurn): void {
    if (conversationStore.threadId !== turn.threadId) {
      conversationStore.settleTurn(turn, undefined)
      return
    }
    conversationStore.reset()
    onThreadActivated?.(null)
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    if (readStoredThread() === turn.threadId) removeStoredThread()
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
    listThreads,
    loadThread,
    entries: computed(() => conversationStore.entries),
    status: computed(() => conversationStore.status),
    isStreaming: computed(() => conversationStore.isStreaming),
    notices: computed(() => notices.value),
    threadId: computed(() => conversationStore.threadId)
  }
}
