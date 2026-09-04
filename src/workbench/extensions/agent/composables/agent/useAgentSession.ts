import { computed, ref, watch } from 'vue'

import { i18n } from '@/i18n'
import type { AgentActiveTabData, TurnId } from '../../schemas/agentApiSchema'
import { isAgentEvent, parseAgentWsEvent } from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftSnapshot,
  OpenTabsSnapshot
} from '../../services/agent/agentRestClient'
import {
  forgetAgentSessionMemory,
  hasAgentSessionMemoryFor,
  readAgentSessionMemory,
  rememberAgentSessionMemory
} from '../../services/agent/agentSessionMemory'
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
  identity?: () => string | null
  workflow?: {
    current(): WorkflowTurnContext | undefined
    adopted(workflowId: string, sent: WorkflowTurnContext | undefined): void
    prepare?(): Promise<void>
    tabs?(): OpenTabsSnapshot | undefined
    activeTab?(data: AgentActiveTabData): void
    draft?(): DraftSnapshot | undefined
  }
}

const PREPARE_TIMEOUT_MS = 3000

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
  let loadGeneration = 0
  let identityGeneration = 0

  if (deps.identity) {
    watch(deps.identity, (identity, previousIdentity) => {
      if (previousIdentity === null && hasAgentSessionMemoryFor(identity)) {
        restorePersistedThread(identity)
        return
      }

      // The app-scoped identity tracker purges the stores and persisted keys.
      // Clear session-local state too so an open panel cannot keep following
      // the previous account's workflow or complete one of its pending loads.
      loadGeneration++
      identityGeneration++
      notices.value = []
      promptEditState.value = { phase: 'idle' }
      sending.value = false
      stopRequestedWhileSending = false
      boundWorkflowId.value = null
      rememberedWorkflowId = null
      forgetAgentSessionMemory()
    })
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

  function restorePersistedThread(identity?: string | null): void {
    if (conversationStore.messages.length !== 0) return

    const storedThreadId = readAgentSessionMemory(identity)
    if (storedThreadId === null) return

    const generation = ++loadGeneration
    conversationStore.setThreadId(storedThreadId)
    void hydrateFromServer(
      storedThreadId,
      () =>
        generation === loadGeneration && ownedGeneration === sessionGeneration
    )
  }

  function start(): void {
    ownedGeneration = ++sessionGeneration
    everLive = false
    const identity = deps.identity?.()
    // The binding only outlives a remount together with its thread: a page
    // with no surviving thread has no resumed turn the binding could serve.
    if (
      conversationStore.threadId === null &&
      readAgentSessionMemory(identity) === null
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
    restorePersistedThread(identity)
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
        forgetAgentSessionMemory()
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
    stopRequestedWhileSending = false
    const operationGeneration = identityGeneration
    const isCurrentIdentity = () => operationGeneration === identityGeneration
    if (workflow?.prepare)
      await Promise.race([
        workflow.prepare().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, PREPARE_TIMEOUT_MS))
      ])
    if (!isCurrentIdentity()) return false
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
    try {
      const ack = await postTurn(conversationStore.threadId ?? 'new')
      if (!isCurrentIdentity()) return false
      conversationStore.setThreadId(ack.thread_id)
      rememberAgentSessionMemory(ack.thread_id, deps.identity?.())
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
      if (!isCurrentIdentity()) return false
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
      if (isCurrentIdentity()) sending.value = false
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

  function newChat(): void {
    loadGeneration++
    promptEditState.value = { phase: 'idle' }
    conversationStore.stashActiveTurn()
    conversationStore.reset()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    forgetAgentSessionMemory()
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
    rememberAgentSessionMemory(threadId, deps.identity?.())
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
