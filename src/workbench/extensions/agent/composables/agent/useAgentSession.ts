import { computed, ref } from 'vue'
import { ZodError } from 'zod'

import { i18n } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  AgentErrorClass,
  AgentErrorMetadata
} from '@/platform/telemetry/types'
import type { AgentActiveTabData, TurnId } from '../../schemas/agentApiSchema'
import { isAgentEvent, parseAgentWsEvent } from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftSnapshot,
  OpenTabsSnapshot
} from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'

export interface AgentEventSource {
  subscribe(listener: (raw: unknown) => void): () => void
  onStatus?(listener: (live: boolean) => void): () => void
}

export interface SessionNotice {
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
  id: string
  tabPath: string
}

type PromptEditState =
  | { phase: 'idle' }
  | { phase: 'stopping'; turnId: TurnId }
  | { phase: 'ready'; turnId: TurnId }

export interface AgentSessionDeps {
  rest: AgentRestClient
  events: AgentEventSource
  workflow?: {
    current(): WorkflowTurnContext | undefined
    adopted(workflowId: string, sent: WorkflowTurnContext | undefined): void
    prepare?(): Promise<void>
    tabs?(): OpenTabsSnapshot | undefined
    activeTab?(data: AgentActiveTabData): void
    draft?(): DraftSnapshot | undefined
  }
}

const THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'
const PREPARE_TIMEOUT_MS = 3000

/**
 * Statuses whose cause is the request itself or the caller's authorization, so
 * a byte-identical retry fails identically. Everything else the backend can
 * return (429, 5xx) and every transport failure is transient enough that
 * `retryable: true` is the honest answer.
 */
const NON_RETRYABLE_REQUEST_STATUSES = new Set([
  400, 401, 403, 404, 405, 409, 410, 422
])

/**
 * Whether resending a failed agent request is safe. `accepted` is decisive: the
 * server is already running the turn, so a retry starts a second one.
 */
function isRetryableRequestFailure(error: unknown, accepted: boolean): boolean {
  if (accepted) return false
  if (error instanceof AgentApiError)
    return !NON_RETRYABLE_REQUEST_STATUSES.has(error.status)
  return true
}

/**
 * `AgentRestClient` validates a response body only after `response.ok`, so a
 * schema failure out of `postMessage` means the server accepted the turn and
 * the FE could not read the ack — post-acceptance, and never safe to resend.
 */
function isResponseSchemaFailure(error: unknown): boolean {
  return error instanceof ZodError
}

let sessionGeneration = 0

/**
 * Page-lifetime binding memory: the workflow a resumed turn belongs to must
 * survive a panel remount. Module-level like `sessionGeneration`;
 * newChat/loadThread clear it.
 */
let rememberedWorkflowId: string | null = null

export function useAgentSession(deps: AgentSessionDeps) {
  const { rest, events, workflow } = deps

  const conversationStore = useAgentConversationStore()
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

  let localErrorCount = 0
  function nextLocalErrorId(): TurnId {
    return `local-error-${++localErrorCount}` as TurnId
  }

  let unsubscribe: (() => void) | null = null
  let unsubscribeStatus: (() => void) | null = null
  let ownedGeneration = 0
  // The status source reports its current state synchronously on subscribe
  // (see agentEventSource.onStatus), so the first callback is a snapshot,
  // not a transition. Track whether we've ever observed a live connection so
  // an initial `false` (still connecting, not yet dropped) doesn't abort a
  // turn that survived a remount.
  let everLive = false

  function pushError(text: string): void {
    notices.value.push({ level: 'error', text })
  }

  /**
   * `app:agent_error` (TEL-8): fires at every FE-visible agent failure site,
   * pre- or post-acceptance, that is not already covered by the backend's
   * `agent_turn_failed`. Both booleans default from the stage — a
   * pre-acceptance failure never started a turn, so nothing was accepted and
   * retrying is always safe, while a post-acceptance failure may have left
   * server-side state the caller cannot fully retry — and both are
   * overridable, because the stage and the two facts it approximates can
   * disagree. A history load that fails on the resume path is a request the
   * server never accepted (`pre_acceptance`) issued while an accepted turn is
   * still streaming (`turn_accepted: true`), and a failed cancel is
   * `post_acceptance` yet safe to send again.
   */
  function trackAgentError(
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
   * The last malformed-frame capture: which turn it belonged to (`null` for the
   * idle stretch between turns) and whether the user saw it. A stream that has
   * drifted from the schema, or a hostile one, repeats the same frame
   * indefinitely, so the capture is deduped per turn rather than per frame —
   * one report carries the same signal without an unbounded PostHog queue
   * behind it. A later frame in the same turn is still reported if it escalates
   * to something the user sees, since that is the case worth a dashboard.
   */
  let malformedStreamReport: {
    turnId: TurnId | null
    visible: boolean
  } | null = null

  /**
   * Every frame that fails `parseAgentWsEvent` is schema drift worth measuring,
   * not just the `agent_message_done` sub-case that reaches the user: the rest
   * are dropped with a `console.warn` no cloud console can see. `uiTreatment`
   * records which of the two the user actually saw. A malformed frame is never
   * retryable — nothing here can be re-sent — and `post_acceptance` is claimed
   * only when a turn really was running. The same dedup bounds what reaches the
   * unified Sentry/RUM sinks, which carry the parse failure itself rather than
   * the normalized class.
   */
  function trackMalformedStreamEvent(
    cause: unknown,
    activeTurnId: TurnId | null,
    uiTreatment: AgentErrorMetadata['ui_treatment']
  ): void {
    const visible = uiTreatment !== 'none'
    if (
      malformedStreamReport?.turnId === activeTurnId &&
      (malformedStreamReport.visible || !visible)
    )
      return
    malformedStreamReport = { turnId: activeTurnId, visible }
    reportError(cause, {
      errorType: 'agent_malformed_stream_event',
      tags: { ui_treatment: uiTreatment }
    })
    trackAgentError(
      'malformed_stream_event',
      activeTurnId === null ? 'pre_acceptance' : 'post_acceptance',
      uiTreatment,
      { retryable: false }
    )
  }

  function start(): void {
    ownedGeneration = ++sessionGeneration
    everLive = false
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
    const surviving = conversationStore.threadId
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
    if (conversationStore.messages.length === 0) {
      const stored = localStorage.getItem(THREAD_STORAGE_KEY)
      if (stored !== null) {
        const generation = ++loadGeneration
        conversationStore.setThreadId(stored)
        void hydrateFromServer(
          stored,
          () =>
            generation === loadGeneration &&
            ownedGeneration === sessionGeneration
        )
      }
    }
  }

  async function hydrateFromServer(
    threadId: string,
    isCurrent: () => boolean = () => true,
    // Set by the resume paths, which stash a still-streaming turn before
    // reloading its thread: the load is a fresh request the server never
    // accepted, but a turn is accepted and running while it fails.
    stashedTurn = false
  ): Promise<boolean> {
    try {
      const history = await rest.getMessages(threadId)
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      conversationStore.hydrate(history)
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
    tags?: SentTag[]
  ): Promise<boolean> {
    if (sending.value) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        i18n.global.t('agent.sendBusy')
      )
      trackAgentError('send_busy', 'pre_acceptance', 'inline_notice')
      return false
    }
    promptEditState.value = { phase: 'idle' }
    sending.value = true
    stopRequestedWhileSending = false
    if (workflow?.prepare)
      await Promise.race([
        workflow.prepare().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, PREPARE_TIMEOUT_MS))
      ])
    const wfContext = workflow?.current()
    const tabs = workflow?.tabs?.()
    async function postTurn(threadId: string) {
      const draft = workflow?.draft?.()
      const shouldSendDraft =
        draft !== undefined && (threadId === 'new' || wfContext !== undefined)
      const input = {
        content: text,
        tabs,
        selection:
          tags !== undefined && tags.length > 0
            ? { node_ids: tags.map((tag) => tag.id) }
            : undefined,
        attachments: attachments?.map((attachment) => attachment.ref),
        ...(shouldSendDraft ? { draft } : {})
      }
      return rest.postMessage(
        threadId,
        wfContext ? { ...input, workflowId: wfContext.id } : input
      )
    }
    // The post-ack bookkeeping below shares this try, so the catch cannot tell
    // a rejected request from a QuotaExceededError out of localStorage or a
    // throwing `adopted` callback. Everything after this flag flips is a
    // failure of a turn the server already started.
    let accepted = false
    try {
      const ack = await postTurn(conversationStore.threadId ?? 'new')
      accepted = true
      conversationStore.setThreadId(ack.thread_id)
      localStorage.setItem(THREAD_STORAGE_KEY, ack.thread_id)
      if (ack.workflow_id !== undefined) {
        bindWorkflow(ack.workflow_id)
        workflow?.adopted(ack.workflow_id, wfContext)
      }
      const turnId = ack.message_id as TurnId
      conversationStore.recordUser(
        turnId,
        text,
        attachments?.map(({ name, previewUrl, ref }) => ({
          name,
          previewUrl,
          ref
        })),
        tags?.map((tag) => `${tag.title} #${tag.id}`)
      )
      conversationStore.startTurn(turnId)
      if (stopRequestedWhileSending) {
        stopRequestedWhileSending = false
        void stopTurn()
      }
      return true
    } catch (error) {
      const turnAccepted = accepted || isResponseSchemaFailure(error)
      const message =
        error instanceof AgentApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error)
      reportError(error, { errorType: 'agent_send_message_failed' })
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        `${i18n.global.t('agent.sendFailed')}: ${message}`
      )
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

  let stopRequestedWhileSending = false

  async function stopTurn(): Promise<void> {
    const threadId = conversationStore.threadId
    const turnId = conversationStore.activeTurnId
    if (threadId === null || turnId === null) {
      // The POST has not acked yet; remember the intent and cancel on ack.
      if (sending.value) stopRequestedWhileSending = true
      return
    }
    promptEditState.value = { phase: 'stopping', turnId }
    try {
      await rest.cancelMessage(threadId, turnId)
    } catch (error) {
      if (error instanceof AgentApiError && error.status === 409) return
      promptEditState.value = { phase: 'idle' }
      reportError(error, { errorType: 'agent_cancel_turn_failed' })
      pushError(error instanceof Error ? error.message : String(error))
      // The line above returned the prompt to idle and the turn is still
      // running, so cancelling again is safe; the already-finished race is
      // handled as the 409 above, not here.
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
      // Read before the abort below clears it, or every aborted turn reports
      // itself as having had no turn.
      const activeTurnId = conversationStore.activeTurnId
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
      trackMalformedStreamEvent(parsed.error, activeTurnId, uiTreatment)
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
        if (
          event.type === 'agent_message_done' &&
          promptEditState.value.phase === 'stopping' &&
          event.data.message_id === promptEditState.value.turnId &&
          (event.data.thread_id === undefined ||
            event.data.thread_id === conversationStore.threadId)
        )
          promptEditState.value = {
            phase: 'ready',
            turnId: promptEditState.value.turnId
          }
    }
  }

  function onStatus(live: boolean): void {
    if (live) {
      everLive = true
      return
    }
    // Only a real live->down transition means a turn's stream was actually
    // interrupted. An initial `false` (socket not open yet) is not a
    // reconnect and must not abort a turn that survived a remount.
    if (!everLive) return
    conversationStore.abortActiveTurn()
    conversationStore.dropBackgroundTurns()
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
