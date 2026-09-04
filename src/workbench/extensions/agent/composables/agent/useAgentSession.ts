import { computed, ref, toValue, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { AgentActiveTabData, TurnId } from '../../schemas/agentApiSchema'
import { isAgentEvent, parseAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentEventSource } from '../../services/agent/agentEventSource'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftSnapshot,
  OpenTabsSnapshot
} from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'

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

let sessionGeneration = 0

/**
 * App-lifetime error-id mint: the ids land in an app-scoped store, so an
 * instance-scoped counter would re-mint duplicates across a remount.
 */
let localErrorCount = 0

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
  let loadGeneration = 0
  let started = false

  const currentUser = useCurrentUser()
  const workspaceStore = useTeamWorkspaceStore()
  const storageScope = computed(() => {
    const userId = toValue(currentUser.resolvedUserInfo)?.id ?? 'signed-out'
    const workspaceId = toValue(workspaceStore.activeWorkspaceId) ?? 'personal'
    return `${encodeURIComponent(userId)}.${encodeURIComponent(workspaceId)}`
  })
  const storageKey = () => `${THREAD_STORAGE_KEY}.${storageScope.value}`

  function pushError(text: string): void {
    notices.value.push({ level: 'error', text })
  }

  function storageGet(): string | null {
    try {
      return localStorage.getItem(storageKey())
    } catch {
      return null
    }
  }
  function storageSet(value: string): void {
    try {
      localStorage.setItem(storageKey(), value)
    } catch (error) {
      reportError(error, { errorType: 'agent_thread_id_persist_failed' })
    }
  }
  function storageRemove(): void {
    try {
      localStorage.removeItem(storageKey())
    } catch (error) {
      reportError(error, { errorType: 'agent_thread_id_clear_failed' })
    }
  }

  function restoreStoredThread(): void {
    if (conversationStore.messages.length !== 0) return
    const stored = storageGet()
    if (stored === null) return
    const generation = ++loadGeneration
    conversationStore.setThreadId(stored)
    void hydrateFromServer(
      stored,
      () =>
        generation === loadGeneration && ownedGeneration === sessionGeneration
    )
  }

  const stopScopeWatch = watch(storageScope, () => {
    if (ownedGeneration !== sessionGeneration) return
    loadGeneration++
    promptEditState.value = { phase: 'idle' }
    conversationStore.dropBackgroundTurns()
    conversationStore.reset()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    if (started) restoreStoredThread()
  })

  function start(): void {
    started = true
    ownedGeneration = ++sessionGeneration
    everLive = false
    // The binding only outlives a remount together with its thread: a page
    // with no surviving thread has no resumed turn the binding could serve.
    if (conversationStore.threadId === null && storageGet() === null) {
      rememberedWorkflowId = null
      boundWorkflowId.value = null
    }
    unsubscribe?.()
    unsubscribeStatus?.()
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
    restoreStoredThread()
  }

  async function hydrateFromServer(
    threadId: string,
    isCurrent: () => boolean = () => true,
    resetOnFailure = false
  ): Promise<boolean> {
    try {
      const history = await rest.getMessages(threadId)
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      conversationStore.stashActiveTurn()
      conversationStore.hydrate(history)
      return true
    } catch (error) {
      if (!isCurrent()) return false
      // Entry-path hydrates committed the identity before fetching; leaving
      // it standing over the previous transcript renders thread A's rows
      // under thread B's id. Rehost keeps its transcript (b7) instead. A
      // turn accepted while the fetch was in flight is stashed first, so
      // it survives the reset and resumes on a later load of its thread.
      const displayed = conversationStore.threadId === threadId
      const resetOwned = resetOnFailure && displayed
      if (error instanceof AgentApiError && error.status === 404) {
        if (resetOwned) {
          conversationStore.stashActiveTurn()
          conversationStore.reset()
        } else if (displayed) conversationStore.setThreadId(null)
        if (displayed) storageRemove()
        return false
      }
      pushError(error instanceof Error ? error.message : String(error))
      if (resetOwned) {
        conversationStore.stashActiveTurn()
        conversationStore.reset()
        storageRemove()
      }
      return false
    }
  }

  function stop(): void {
    started = false
    stopScopeWatch()
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
    if (sending.value || conversationStore.activeTurnId !== null) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        i18n.global.t('agent.sendBusy')
      )
      return false
    }
    promptEditState.value = { phase: 'idle' }
    sending.value = true
    stopRequestedWhileSending = false
    let wfContext: WorkflowTurnContext | undefined
    let tabs: OpenTabsSnapshot | undefined
    const destinationThread = conversationStore.threadId ?? 'new'
    const initiatingGeneration = loadGeneration
    const initiatingOwner = ownedGeneration
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
    try {
      let ack
      try {
        if (workflow?.prepare)
          await Promise.race([
            workflow.prepare().catch(() => undefined),
            new Promise<void>((resolve) =>
              setTimeout(resolve, PREPARE_TIMEOUT_MS)
            )
          ])
        wfContext = workflow?.current()
        tabs = workflow?.tabs?.()
        if (
          initiatingOwner !== sessionGeneration ||
          initiatingGeneration !== loadGeneration ||
          (conversationStore.threadId ?? 'new') !== destinationThread
        )
          return false
        ack = await postTurn(destinationThread)
      } catch (error) {
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
      }
      // The server accepted the turn: the store transitions are owed
      // unconditionally, before any fallible local side effect, or the
      // reply's events arrive with no open turn to land in.
      const turnId = ack.message_id as TurnId
      const sentAttachments = attachments?.map(({ name, previewUrl, ref }) => ({
        name,
        previewUrl,
        ref
      }))
      const sentTags = tags?.map((tag) => `${tag.title} #${tag.id}`)
      const stillDisplayed =
        initiatingOwner === sessionGeneration &&
        initiatingGeneration === loadGeneration &&
        (conversationStore.threadId ?? 'new') === destinationThread
      if (!stillDisplayed) {
        conversationStore.startBackgroundTurn(
          ack.thread_id,
          turnId,
          text,
          sentAttachments,
          sentTags
        )
        if (stopRequestedWhileSending) {
          stopRequestedWhileSending = false
          try {
            await rest.cancelMessage(ack.thread_id, turnId)
          } catch (error) {
            if (!(error instanceof AgentApiError && error.status === 409))
              pushError(error instanceof Error ? error.message : String(error))
          }
        }
        return true
      }
      conversationStore.setThreadId(ack.thread_id)
      conversationStore.recordUser(turnId, text, sentAttachments, sentTags)
      conversationStore.startTurn(turnId)
      if (ack.workflow_id !== undefined) bindWorkflow(ack.workflow_id)
      storageSet(ack.thread_id)
      try {
        if (ack.workflow_id !== undefined)
          workflow?.adopted(ack.workflow_id, wfContext)
      } catch (error) {
        // Consumer bookkeeping cannot retract an accepted turn.
        reportError(error, { errorType: 'agent_workflow_adopted_failed' })
      }
      if (stopRequestedWhileSending) {
        stopRequestedWhileSending = false
        void stopTurn()
      }
      return true
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

  function newChat(): void {
    loadGeneration++
    promptEditState.value = { phase: 'idle' }
    conversationStore.stashActiveTurn()
    conversationStore.reset()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    storageRemove()
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
    storageSet(threadId)
    const hydrated = await hydrateFromServer(threadId, isCurrent, true)
    if (hydrated && isCurrent()) conversationStore.resumeBackgroundTurn()
  }

  function onRaw(raw: unknown): void {
    if (ownedGeneration !== sessionGeneration) return
    if (typeof raw !== 'object' || raw === null) return
    const type = (raw as { type?: unknown }).type
    if (typeof type !== 'string' || !isAgentEvent(type)) return
    const parsed = parseAgentWsEvent(raw)
    if (!parsed.success) {
      const messageId = (raw as { data?: { message_id?: unknown } }).data
        ?.message_id
      const rawThreadId = (raw as { data?: { thread_id?: unknown } }).data
        ?.thread_id
      if (type === 'agent_message_done') {
        if (
          (rawThreadId === undefined ||
            rawThreadId === conversationStore.threadId) &&
          (typeof messageId !== 'string' ||
            messageId === conversationStore.activeTurnId)
        ) {
          conversationStore.abortActiveTurn()
          pushError(i18n.global.t('agent.malformedEvent'))
        } else if (
          typeof rawThreadId === 'string' &&
          typeof messageId === 'string'
        ) {
          conversationStore.settleBackgroundTurn(rawThreadId, messageId)
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
    // A stale session instance (one whose generation has been superseded by a
    // remount or an identity change) must never abort the live instance's turns.
    if (ownedGeneration !== sessionGeneration) return
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
