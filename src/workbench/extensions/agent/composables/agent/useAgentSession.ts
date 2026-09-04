import { computed, ref } from 'vue'

import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import type { AgentActiveTabData, TurnId } from '../../schemas/agentApiSchema'
import {
  isAgentEvent,
  parseAgentWsEvent,
  zAgentAdmissionError
} from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftSnapshot,
  OpenTabsSnapshot
} from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'

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
  id?: string
  tabPath: string
}

/**
 * Which tab a turn belongs to, resolved once before prepare() and then handed
 * to every post-await lookup. The three states are deliberately distinct:
 *
 * - omitted: resolve whatever tab is active right now. Only correct outside a
 *   send, where there is nothing to pin to.
 * - `null`: the send had no origin tab at all (panel detached, or no workflow
 *   open when it started).
 * - `{ tabPath }`: pin resolution to that tab.
 *
 * Collapsing `null` into the omitted case is what lets a detached send pick up
 * whichever tab the user selects during prepare(), i.e. exactly the late
 * binding this pin exists to remove.
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
    // origin, when given, pins resolution to the tab that initiated the send
    // instead of whatever tab is active when this is called - it is read
    // after prepare() so cloud ids it resolves are fresh, but must still
    // describe the pre-await originating tab, not a later switch. See
    // TurnOrigin for why "no origin tab" is a value rather than an omission.
    current(origin?: TurnOrigin): WorkflowTurnContext | undefined
    adopted(workflowId: string, sent: WorkflowTurnContext | undefined): void
    prepare?(): Promise<void>
    tabs?(origin?: TurnOrigin): OpenTabsSnapshot | undefined
    activeTab?(data: AgentActiveTabData): void
    draft?(origin?: TurnOrigin): DraftSnapshot | undefined
  }
}

const THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'
const PREPARE_TIMEOUT_MS = 3000

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
  if (!parsed.success) return undefined
  return { ...parsed.data.error, retryAfterSeconds: error.retryAfterSeconds }
}

function admissionNoticeText(admission: {
  message: string
  reason: string
  retryAfterSeconds?: number
}): string {
  if (
    admission.reason !== 'funds_unavailable' ||
    admission.retryAfterSeconds === undefined
  ) {
    return admission.message
  }
  const count = Math.max(1, Math.ceil(admission.retryAfterSeconds))
  return `${admission.message} ${i18n.global.t('agent.retryAfter', { count }, count)}`
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
      conversationStore.stashActiveTurn()
      void hydrateFromServer(surviving, isCurrent).then(() => {
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
    isCurrent: () => boolean = () => true
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
      pushError(error instanceof Error ? error.message : String(error))
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
      return false
    }
    promptEditState.value = { phase: 'idle' }
    sending.value = true
    stopRequestedWhileSending.value = false
    // Capture the originating tab identity before the first await: prepare()
    // can take up to PREPARE_TIMEOUT_MS, and a tab switch while it is
    // pending must not reattribute this send to the newly active tab. The id
    // lookups themselves stay post-await (prepare() is what warms them), but
    // pinned to this originating path rather than whatever is active later.
    // A send that starts with no origin tab must stay that way: `null` is not
    // "resolve the active tab", or re-attaching during prepare() reattributes
    // the turn to the tab selected afterwards.
    const originContext = workflow?.current()
    const origin: TurnOrigin =
      originContext === undefined ? null : { tabPath: originContext.tabPath }
    if (workflow?.prepare)
      await Promise.race([
        workflow.prepare().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, PREPARE_TIMEOUT_MS))
      ])
    const wfContext = workflow?.current(origin)
    const tabs = workflow?.tabs?.(origin)
    async function postTurn(threadId: string) {
      const draft = workflow?.draft?.(origin)
      // An unsaved tab now yields a context carrying only its tabPath, so a
      // merely-defined wfContext no longer implies the tab has a workflow the
      // thread could own. An existing thread takes a draft only from a tab
      // with a real workflow id; otherwise an unbound scratch tab would leak
      // its canvas into someone else's thread.
      const shouldSendDraft =
        draft !== undefined &&
        (threadId === 'new' || wfContext?.id !== undefined)
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
        wfContext?.id !== undefined
          ? { ...input, workflowId: wfContext.id }
          : input
      )
    }
    try {
      const ack = await postTurn(conversationStore.threadId ?? 'new')
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
        attachments?.map(({ name, previewUrl, ref }) => ({
          name,
          previewUrl,
          ref
        })),
        tags?.map((tag) => `${tag.title} #${tag.id}`)
      )
      conversationStore.startTurn(turnId)
      if (wasStopRequestedWhileSending()) {
        stopRequestedWhileSending.value = false
        void stopTurn()
      }
      return true
    } catch (error) {
      const admission = parseAdmissionError(error)
      if (admission?.reason === 'no_funds') {
        conversationStore.recordPaywall(nextLocalErrorId(), text)
        return false
      }
      if (admission !== undefined) {
        conversationStore.recordFailedSend(
          nextLocalErrorId(),
          text,
          admissionNoticeText(admission)
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
        pushError(error.message)
        return
      }
      promptEditState.value = { phase: 'idle' }
      pushError(error instanceof Error ? error.message : String(error))
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
    conversationStore.stashActiveTurn()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    conversationStore.setThreadId(threadId)
    localStorage.setItem(THREAD_STORAGE_KEY, threadId)
    const hydrated = await hydrateFromServer(threadId, isCurrent)
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
      if (type === 'agent_message_done') {
        if (
          typeof messageId !== 'string' ||
          messageId === conversationStore.activeTurnId
        ) {
          conversationStore.abortActiveTurn()
          pushError(i18n.global.t('agent.malformedEvent'))
        } else {
          conversationStore.settleBackgroundTurn(messageId)
        }
      }
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
          event.data.thread_id === conversationStore.threadId
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
