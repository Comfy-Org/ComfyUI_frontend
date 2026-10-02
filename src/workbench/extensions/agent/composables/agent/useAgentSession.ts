import { delay } from 'es-toolkit'
import { computed, ref } from 'vue'
import { ZodError } from 'zod'

import { i18n } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  AgentErrorClass,
  AgentErrorMetadata
} from '@/platform/telemetry/types'
import { createUuidv4 } from '@/utils/uuid'
import type {
  AgentActiveTabData,
  AgentMessages,
  TurnId
} from '../../schemas/agentApiSchema'
import {
  isAgentEvent,
  parseAgentWsEvent,
  toTurnId,
  zAgentAdmissionError
} from '../../schemas/agentApiSchema'
import {
  AgentApiError,
  AgentResponseUnreadableError
} from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftSnapshot,
  OpenTabsSnapshot
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
  subfolder?: string
  uploadType?: string
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

export interface AgentSessionDeps {
  rest: AgentRestClient
  events: AgentEventSource
  workflow?: {
    /** Resolve fresh versus restored startup before asynchronous hydration. */
    initialize?(hasThread: boolean): void
    // origin, when given, pins resolution to the tab that initiated the send
    // instead of the target selected when this is called - it is read
    // after prepare() so cloud ids it resolves are fresh, but must still
    // describe the pre-await originating tab, not a later switch. See
    // TurnOrigin for why "no origin tab" is a value rather than an omission.
    current(origin?: TurnOrigin): WorkflowTurnContext | undefined
    adopted(workflowId: string, sent: WorkflowTurnContext | undefined): void
    restored?(
      workflowId: string | undefined,
      isCurrent: () => boolean
    ): Promise<void> | void
    prepare?(): Promise<void>
    tabs?(origin?: TurnOrigin): OpenTabsSnapshot | undefined
    activeTab?(data: AgentActiveTabData): void
    draft?(origin?: TurnOrigin): DraftSnapshot | undefined
  }
}

const THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'
const PREPARE_TIMEOUT_MS = 3000
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

export function isRetryableRequestFailure(
  error: unknown,
  accepted: boolean
): boolean {
  if (accepted) return false
  if (error instanceof AgentApiError) {
    if ([408, 425, 429].includes(error.status)) return true
    return error.status < 400 || error.status >= 500
  }
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

let sessionGeneration = 0

/**
 * Page-lifetime binding memory: the workflow a resumed turn belongs to must
 * survive a panel remount. Module-level like `sessionGeneration`;
 * newChat/loadThread clear it.
 */
let rememberedWorkflowId: string | null = null

function parseAdmissionError(error: unknown) {
  if (!(error instanceof AgentApiError)) return undefined
  const parsed = zAgentAdmissionError.safeParse(error.body)
  return parsed.success ? parsed.data.error : undefined
}

export function useAgentSession(deps: AgentSessionDeps) {
  const { rest, events, workflow } = deps

  const conversationStore = useAgentConversationStore()
  const bindingStore = useAgentWorkflowTabBindingStore()
  /**
   * The workflow the session is bound to (set on turn ack or an active-tab
   * switch, cleared by newChat/loadThread) - the CRDT follower's subscribe
   * target.
   */
  const boundWorkflowId = ref<string | null>(rememberedWorkflowId)

  const notices = ref<SessionNotice[]>([])
  const promptEditState = ref<PromptEditState>({ phase: 'idle' })
  const sending = ref(false)
  const answeringAskIds = ref<ReadonlySet<string>>(new Set())

  function setAskAnswering(askId: string, answering: boolean): void {
    const next = new Set(answeringAskIds.value)
    if (answering) next.add(askId)
    else next.delete(askId)
    answeringAskIds.value = next
  }

  function nextLocalErrorId(): TurnId {
    return toTurnId(`local-error-${createUuidv4()}`)
  }

  let unsubscribe: (() => void) | null = null
  let unsubscribeStatus: (() => void) | null = null
  let ownedGeneration = 0
  let connection: SocketConnection = 'initial'
  const recoveringTurns = new Map<string, AbortController>()

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
    if (
      !malformedStreamReports.has(turnId) &&
      malformedStreamReports.size >= 32
    )
      return
    malformedStreamReports.set(turnId, visible)
    reportError(new Error('Malformed agent stream event'), {
      errorType: 'agent_malformed_stream_event',
      tags: { ui_treatment: uiTreatment, event_type: eventType },
      context: {
        issues: cause.issues.slice(0, 10).map(({ code, path, message }) => ({
          code,
          path,
          message
        }))
      }
    })
    trackAgentError(
      'malformed_stream_event',
      turnId === null ? 'pre_acceptance' : 'post_acceptance',
      uiTreatment,
      { retryable: false }
    )
  }

  function start({ restore = true }: { restore?: boolean } = {}): void {
    ownedGeneration = ++sessionGeneration
    connection = 'initial'
    const surviving = conversationStore.threadId
    const stored =
      conversationStore.messages.length === 0
        ? localStorage.getItem(THREAD_STORAGE_KEY)
        : null
    workflow?.initialize?.(surviving !== null || stored !== null)
    // The binding only outlives a remount together with its thread: a page
    // with no surviving thread has no resumed turn the binding could serve.
    if (
      conversationStore.threadId === null &&
      localStorage.getItem(THREAD_STORAGE_KEY) === null
    ) {
      rememberedWorkflowId = null
      boundWorkflowId.value = null
    }
    unsubscribe = events.subscribe(onRaw)
    if (events.onStatus) unsubscribeStatus = events.onStatus(onStatus)
    if (!restore) return
    if (surviving !== null) {
      const generation = ++loadGeneration
      const isCurrent = () =>
        generation === loadGeneration && ownedGeneration === sessionGeneration
      const stashedTurn = conversationStore.activeTurnId !== null
      conversationStore.stashActiveTurn()
      void hydrateFromServer(surviving, isCurrent, stashedTurn).then(() => {
        if (isCurrent() && conversationStore.threadId === surviving)
          conversationStore.resumeBackgroundTurn()
      })
      return
    }
    if (stored !== null) {
      const generation = ++loadGeneration
      conversationStore.setThreadId(stored)
      void hydrateFromServer(
        stored,
        () =>
          generation === loadGeneration && ownedGeneration === sessionGeneration
      )
    }
  }

  async function hydrateFromServer(
    threadId: string,
    isCurrent: () => boolean = () => true,
    stashedTurn = false
  ): Promise<boolean> {
    try {
      const history = await rest.getMessages(threadId)
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      conversationStore.hydrate(history)
      reconcileLiveTurns()
      await workflow?.restored?.(conversationStore.latestWorkflowId, isCurrent)
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      return true
    } catch (error) {
      if (!isCurrent()) return false
      if (error instanceof AgentApiError && error.status === 404) {
        if (conversationStore.threadId === threadId)
          conversationStore.setThreadId(null)
        localStorage.removeItem(THREAD_STORAGE_KEY)
        return false
      }
      reportError(error, { errorType: 'agent_history_load_failed' })
      pushError(error instanceof Error ? error.message : String(error))
      trackAgentError(
        'history_load_failed',
        'pre_acceptance',
        'error_overlay',
        {
          retryable: isRetryableRequestFailure(error, false),
          turnAccepted: stashedTurn
        }
      )
      return false
    }
  }

  function stop(): void {
    unsubscribe?.()
    unsubscribeStatus?.()
    unsubscribe = null
    unsubscribeStatus = null
    for (const recovery of recoveringTurns.values()) recovery.abort()
    recoveringTurns.clear()
    const stoppedGeneration = ownedGeneration
    queueMicrotask(() => {
      if (stoppedGeneration !== sessionGeneration) return
      conversationStore.abortActiveTurn()
      conversationStore.dropBackgroundTurns()
    })
  }

  async function sendMessage(
    text: string,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[]
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
    stopRequestedWhileSending.value = false
    const generation = loadGeneration
    const threadAtSend = conversationStore.threadId ?? 'new'
    const originContext = workflow?.current()
    const origin: TurnOrigin =
      originContext === undefined ? null : { tabPath: originContext.tabPath }
    let accepted = false
    let requestStarted = false
    try {
      if (workflow?.prepare)
        await Promise.race([
          workflow.prepare().catch(() => undefined),
          new Promise<void>((resolve) =>
            setTimeout(resolve, PREPARE_TIMEOUT_MS)
          )
        ])
      if (generation !== loadGeneration) return false
      const wfContext = workflow?.current(origin)
      if (
        originContext?.id !== undefined &&
        wfContext?.id !== originContext.id
      ) {
        conversationStore.recordFailedSend(
          nextLocalErrorId(),
          text,
          i18n.global.t('agent.targetNavigationUnavailable')
        )
        return false
      }
      const tabs = workflow?.tabs?.(origin)
      // current_tab_unbound's own contract (see its generated doc comment) is
      // a tab-level fact: this tab has no cloud id yet. wfContext with no id
      // is exactly that (a saved tab whose cloud id failed to resolve makes
      // wfContext undefined entirely instead - see targetWorkflowTurnContext).
      //
      // boundWorkflowId === null narrows WHEN we assert that fact, and is a
      // client-side policy choice, not part of the field's own meaning: the
      // server has no way yet to tell "this thread's remembered workflow is
      // itself my own prior unbound mint for this same tab" apart from "an
      // unrelated workflow from a different tab", so asserting the flag on
      // every turn a still-unbound tab is asked about would mint a fresh,
      // contentless workflow each time. Once any turn this session has bound
      // a workflow, that binding (or the thread's own remembered workflow) is
      // a safer target than minting again. Telling the server this is a
      // selected-but-unbound tab, not "nothing selected", is what keeps the
      // seed from telling the model no workflow is selected - see
      // PM-1429/PM-1430.
      const unboundTarget =
        wfContext !== undefined &&
        wfContext.id === undefined &&
        boundWorkflowId.value === null
      async function postTurn(threadId: string) {
        const draft = workflow?.draft?.(origin)
        // An unsaved tab now yields a context carrying only its tabPath, so a
        // merely-defined wfContext no longer implies the tab has a workflow the
        // thread could own. An existing thread takes a draft only from a tab
        // with a real workflow id, or from an unbound target we are about to
        // flag as such (the server mints a workflow for it, and an empty mint
        // would drop whatever is already on the tab's canvas).
        const shouldSendDraft =
          draft !== undefined &&
          (threadId === 'new' || wfContext?.id !== undefined || unboundTarget)
        const input = {
          content: serializeWorkflowReferences(text, workflowReferences ?? []),
          tabs,
          workflowReferences: (workflowReferences ?? [])
            .filter((reference) => reference.id !== wfContext?.id)
            .map((reference) => ({
              workflow_id: reference.id,
              name: reference.name
            })),
          selection:
            tags !== undefined && tags.length > 0
              ? { node_ids: tags.map((tag) => tag.id) }
              : undefined,
          attachments: attachments?.map((attachment) =>
            attachment.subfolder
              ? `${attachment.subfolder}/${attachment.ref}`
              : attachment.ref
          ),
          ...(unboundTarget ? { currentTabUnbound: true } : {}),
          ...(shouldSendDraft ? { draft } : {})
        }
        return rest.postMessage(
          threadId,
          wfContext?.id !== undefined
            ? { ...input, workflowId: wfContext.id }
            : input
        )
      }
      requestStarted = true
      const ack = await postTurn(threadAtSend)
      accepted = true
      if (generation !== loadGeneration) return false
      conversationStore.setThreadId(ack.thread_id)
      localStorage.setItem(THREAD_STORAGE_KEY, ack.thread_id)
      if (ack.workflow_id !== undefined) {
        // The ack does not say whether the server minted a workflow or echoed
        // the thread's existing one. The persisted binding store preserves
        // ownership across reloads; the session binding covers a bind that
        // lands while this request is in flight.
        const boundAtAck = boundWorkflowId.value
        bindWorkflow(ack.workflow_id)
        const shouldAdopt =
          wfContext?.id !== undefined ||
          (ack.workflow_id !== boundAtAck &&
            bindingStore.tabPathFor(ack.workflow_id) === undefined)
        if (shouldAdopt) workflow?.adopted(ack.workflow_id, wfContext)
      }
      const turnId = ack.message_id as TurnId
      conversationStore.recordUser(
        turnId,
        text,
        attachments?.map(
          ({ name, previewUrl, ref, subfolder, uploadType }) => ({
            name,
            previewUrl,
            ref,
            subfolder,
            uploadType
          })
        ),
        tags?.map((tag) => `${tag.title} #${tag.id}`),
        workflowReferences
      )
      conversationStore.startTurn(turnId)
      if (wasStopRequestedWhileSending()) {
        stopRequestedWhileSending.value = false
        void stopTurn()
      }
      return true
    } catch (error) {
      if (generation !== loadGeneration) return false
      const admission = parseAdmissionError(error)
      if (admission?.reason === 'no_funds') {
        conversationStore.recordPaywall(nextLocalErrorId(), text)
        return false
      }
      if (admission !== undefined) {
        // `funds_unavailable` is a transient billing-lookup failure (503) the
        // server asks the client to retry after a delay; `manual_block` is a
        // deliberate 402 with no retry semantics. Only the former carries
        // `retryAfterSeconds` through, so the UI never implies a countdown
        // for an operator-imposed block. See FE-2005.
        const retryAfterSeconds =
          admission.reason === 'funds_unavailable' &&
          error instanceof AgentApiError
            ? error.retryAfterSeconds
            : undefined
        conversationStore.recordFailedSend(
          nextLocalErrorId(),
          text,
          admission.message,
          retryAfterSeconds
        )
        return false
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
      const turnAccepted =
        accepted || (requestStarted && isUnreadableAckFailure(error))
      reportError(error, { errorType: 'agent_send_message_failed' })
      trackAgentError(
        'request_failed',
        turnAccepted ? 'post_acceptance' : 'pre_acceptance',
        'inline_notice',
        { retryable: isRetryableRequestFailure(error, turnAccepted) }
      )
      return false
    } finally {
      sending.value = false
    }
  }

  const stopRequestedWhileSending = ref(false)
  const wasStopRequestedWhileSending = () => stopRequestedWhileSending.value

  async function stopTurn(): Promise<void> {
    const threadId = conversationStore.threadId
    const turnId = conversationStore.activeTurnId
    if (threadId === null || turnId === null) {
      // The POST has not acked yet; remember the intent and cancel on ack.
      if (sending.value) stopRequestedWhileSending.value = true
      return
    }
    promptEditState.value = { phase: 'stopping', turnId }
    try {
      await rest.cancelMessage(threadId, turnId)
    } catch (error) {
      if (error instanceof AgentApiError) {
        if (error.status === 409) return
        promptEditState.value = { phase: 'idle' }
        reportError(error, { errorType: 'agent_cancel_turn_failed' })
        pushError(error.message)
        trackAgentError('cancel_failed', 'post_acceptance', 'error_overlay', {
          retryable: isRetryableRequestFailure(error, false)
        })
        return
      }
      promptEditState.value = { phase: 'idle' }
      reportError(error, { errorType: 'agent_cancel_turn_failed' })
      pushError(error instanceof Error ? error.message : String(error))
      trackAgentError('cancel_failed', 'post_acceptance', 'error_overlay', {
        retryable: true
      })
    }
  }

  async function answerAsk(
    askId: string,
    selection: 'run' | 'cancel'
  ): Promise<void> {
    const currentThreadId = conversationStore.threadId
    const messageId = conversationStore.activeTurnId
    if (
      currentThreadId === null ||
      messageId === null ||
      answeringAskIds.value.has(askId)
    )
      return
    setAskAnswering(askId, true)
    try {
      await rest.answerAsk(currentThreadId, askId, [selection])
      // Keep the actions disabled until the canonical resolution frame arrives.
    } catch (error) {
      setAskAnswering(askId, false)
      if (error instanceof AgentApiError && error.status === 409) {
        conversationStore.ingest({
          type: 'agent_ask_resolved',
          data: {
            thread_id: currentThreadId,
            message_id: messageId,
            ask_id: askId,
            status: 'answered',
            selected: null
          }
        })
        return
      }
      reportError(error, { errorType: 'agent_ask_answer_failed' })
      pushError(error instanceof Error ? error.message : String(error))
      trackAgentError('ask_answer_failed', 'post_acceptance', 'error_overlay', {
        retryable: isRetryableRequestFailure(error, false)
      })
    }
  }

  let loadGeneration = 0

  function newChat(): void {
    loadGeneration++
    promptEditState.value = { phase: 'idle' }
    conversationStore.stashActiveTurn()
    conversationStore.reset()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    malformedStreamReports.clear()
    localStorage.removeItem(THREAD_STORAGE_KEY)
  }

  function listThreads() {
    return rest.listThreads()
  }

  async function loadThread(threadId: string): Promise<void> {
    const generation = ++loadGeneration
    promptEditState.value = { phase: 'idle' }
    const isCurrent = () =>
      generation === loadGeneration && ownedGeneration === sessionGeneration
    const stashedTurn = conversationStore.activeTurnId !== null
    conversationStore.stashActiveTurn()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    malformedStreamReports.clear()
    conversationStore.setThreadId(threadId)
    localStorage.setItem(THREAD_STORAGE_KEY, threadId)
    const hydrated = await hydrateFromServer(threadId, isCurrent, stashedTurn)
    if (hydrated && isCurrent()) conversationStore.resumeBackgroundTurn()
  }

  function onRaw(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    const type = (raw as { type?: unknown }).type
    if (typeof type !== 'string' || !isAgentEvent(type)) return
    const parsed = parseAgentWsEvent(raw)
    if (!parsed.success) {
      const messageId = (raw as { data?: { message_id?: unknown } }).data
        ?.message_id
      const wireTurnId =
        typeof messageId === 'string' ? (messageId as TurnId) : null
      const reportedTurnId =
        wireTurnId !== null && conversationStore.hasPendingTurn(wireTurnId)
          ? wireTurnId
          : conversationStore.activeTurnId
      let uiTreatment: AgentErrorMetadata['ui_treatment'] = 'none'
      if (type === 'agent_message_done') {
        if (
          typeof messageId !== 'string' ||
          messageId === conversationStore.activeTurnId
        ) {
          conversationStore.abortActiveTurn()
          pushError(i18n.global.t('agent.malformedEvent'))
          uiTreatment = 'error_overlay'
        } else {
          conversationStore.settleBackgroundTurn(messageId)
        }
      }
      trackMalformedStreamEvent(parsed.error, type, reportedTurnId, uiTreatment)
      console.warn('[agent] dropping malformed agent event', parsed.error)
      return
    }
    const event = parsed.data
    if (event.type === 'agent_ask_resolved')
      setAskAnswering(event.data.ask_id, false)
    switch (event.type) {
      case 'agent_active_tab':
        // Every thread records the link in its own transcript; only the thread
        // on screen is allowed to move the user's tabs.
        conversationStore.ingest(event)
        if (
          event.data.thread_id === undefined ||
          event.data.thread_id === conversationStore.threadId
        )
          workflow?.activeTab?.(event.data)
        return
      default:
        conversationStore.ingest(event)
        if (event.type === 'agent_message_done')
          markStoppedTurnReady({
            threadId: event.data.thread_id,
            messageId: toTurnId(event.data.message_id)
          })
    }
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
        reportError(error, { errorType: 'failure_recovering_agent_turn' })
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

  /**
   * Only a terminal outcome may hand the prompt back. A delta after Stop leaves
   * the turn live on the server, so exposing Edit there would let the resend
   * race the single-active-turn lock.
   */
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
      const parts = mergeAdjacentTextParts(
        normalizeAgentTranscript(rows).messages[0]?.parts ?? []
      )
      const preserveLocalParts =
        parts.length === 0 && rows.every((row) => row.status === 'complete')
      return {
        kind: 'terminal',
        parts: preserveLocalParts ? undefined : parts
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
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    localStorage.removeItem(THREAD_STORAGE_KEY)
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
    isSending,
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
