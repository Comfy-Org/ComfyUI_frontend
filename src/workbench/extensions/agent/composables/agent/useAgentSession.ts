import { computed, ref } from 'vue'

import { i18n } from '@/i18n'
import type { AgentActiveTabData, TurnId } from '../../schemas/agentApiSchema'
import { isAgentEvent, parseAgentWsEvent } from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftUpload,
  OpenTabsSnapshot
} from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'

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

export interface AgentSessionDeps {
  rest: AgentRestClient
  events: AgentEventSource
  workflow?: {
    current(): WorkflowTurnContext | undefined
    adopted(
      workflowId: string,
      sent: WorkflowTurnContext | undefined,
      uploaded: boolean
    ): void
    prepare?(): Promise<void>
    snapshot?(): DraftUpload | undefined
    uploadSkipped?(): void
    tabs?(): OpenTabsSnapshot | undefined
    activeTab?(data: AgentActiveTabData): void
  }
}

const THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'
const PREPARE_TIMEOUT_MS = 3000

export function useAgentSession(deps: AgentSessionDeps) {
  const { rest, events, workflow } = deps

  const conversationStore = useAgentConversationStore()
  const draftStore = useAgentDraftStore()

  const notices = ref<SessionNotice[]>([])
  let resyncing = false
  const sending = ref(false)

  let localErrorCount = 0
  function nextLocalErrorId(): TurnId {
    return `local-error-${++localErrorCount}` as TurnId
  }

  let unsubscribe: (() => void) | null = null
  let unsubscribeStatus: (() => void) | null = null

  function pushError(text: string): void {
    notices.value.push({ level: 'error', text })
  }

  async function resyncDraft(): Promise<void> {
    const id = draftStore.workflowId
    if (id === null || resyncing) return
    resyncing = true
    try {
      const snapshot = await rest.getDraft(id)
      if (draftStore.workflowId === id) draftStore.adoptSnapshot(snapshot)
    } catch (error) {
      if (error instanceof AgentApiError) {
        if (error.status === 404) return
        pushError(error.message)
        return
      }
      pushError(error instanceof Error ? error.message : String(error))
    } finally {
      resyncing = false
    }
  }

  function start(): void {
    unsubscribe = events.subscribe(onRaw)
    if (events.onStatus) unsubscribeStatus = events.onStatus(onStatus)
    const surviving = conversationStore.threadId
    if (surviving !== null) {
      const generation = ++loadGeneration
      void hydrateFromServer(surviving, () => generation === loadGeneration)
      return
    }
    if (conversationStore.messages.length === 0) {
      const stored = localStorage.getItem(THREAD_STORAGE_KEY)
      if (stored !== null) {
        const generation = ++loadGeneration
        conversationStore.setThreadId(stored)
        void hydrateFromServer(stored, () => generation === loadGeneration)
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
    conversationStore.abortActiveTurn()
    conversationStore.dropBackgroundTurns()
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
    sending.value = true
    if (workflow?.prepare)
      await Promise.race([
        workflow.prepare().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, PREPARE_TIMEOUT_MS))
      ])
    const wfContext = workflow?.current()
    const upload = workflow?.snapshot?.()
    const tabs = workflow?.tabs?.()
    function buildInput(draft: DraftUpload | undefined) {
      return {
        content: text,
        tabs,
        selection:
          tags !== undefined && tags.length > 0
            ? { node_ids: tags.map((tag) => tag.id) }
            : undefined,
        attachments: attachments?.map((attachment) => attachment.ref),
        draft
      }
    }
    async function post(threadId: string, draft: DraftUpload | undefined) {
      const input = buildInput(draft)
      return rest.postMessage(
        threadId,
        wfContext ? { ...input, workflowId: wfContext.id } : input
      )
    }
    let uploaded = upload !== undefined
    async function postTurn(threadId: string) {
      try {
        return await post(threadId, upload)
      } catch (error) {
        if (!(error instanceof AgentApiError)) throw error
        const serverVersion = (error.body as { version?: unknown } | null)
          ?.version
        if (
          error.status === 409 &&
          upload !== undefined &&
          typeof serverVersion === 'number'
        ) {
          return await post(threadId, { ...upload, version: serverVersion })
        }
        if (upload !== undefined && error.status >= 500) {
          console.warn(
            '[agent] draft upload rejected by the server, sending without it',
            error.message
          )
          const ack = await post(threadId, undefined)
          uploaded = false
          workflow?.uploadSkipped?.()
          return ack
        }
        throw error
      }
    }
    try {
      const ack = await postTurn(conversationStore.threadId ?? 'new')
      conversationStore.setThreadId(ack.thread_id)
      localStorage.setItem(THREAD_STORAGE_KEY, ack.thread_id)
      if (ack.workflow_id !== undefined) {
        draftStore.bind(ack.workflow_id)
        workflow?.adopted(ack.workflow_id, wfContext, uploaded)
      }
      const turnId = ack.message_id as TurnId
      conversationStore.recordUser(
        turnId,
        text,
        attachments?.map(({ name, previewUrl }) => ({ name, previewUrl })),
        tags?.map((tag) => tag.title)
      )
      conversationStore.startTurn(turnId)
      return true
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
    } finally {
      sending.value = false
    }
  }

  async function stopTurn(): Promise<void> {
    const threadId = conversationStore.threadId
    const turnId = conversationStore.activeTurnId
    if (threadId === null || turnId === null) return
    try {
      await rest.cancelMessage(threadId, turnId)
    } catch (error) {
      if (error instanceof AgentApiError) {
        if (error.status === 409) return
        pushError(error.message)
        return
      }
      pushError(error instanceof Error ? error.message : String(error))
    }
  }

  let loadGeneration = 0

  function newChat(): void {
    loadGeneration++
    conversationStore.stashActiveTurn()
    conversationStore.reset()
    draftStore.reset()
    localStorage.removeItem(THREAD_STORAGE_KEY)
  }

  function listThreads() {
    return rest.listThreads()
  }

  async function loadThread(threadId: string): Promise<void> {
    const generation = ++loadGeneration
    conversationStore.stashActiveTurn()
    draftStore.reset()
    conversationStore.setThreadId(threadId)
    localStorage.setItem(THREAD_STORAGE_KEY, threadId)
    const hydrated = await hydrateFromServer(
      threadId,
      () => generation === loadGeneration
    )
    if (hydrated && generation === loadGeneration)
      conversationStore.resumeBackgroundTurn()
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
      case 'draft_patch':
        if (
          event.data.thread_id === undefined ||
          event.data.thread_id === conversationStore.threadId
        )
          draftStore.applyPatch(event.data)
        return
      case 'draft_version':
        if (draftStore.checkHeartbeat(event.data) === 'behind')
          void resyncDraft()
        return
      case 'agent_active_tab':
        if (
          event.data.thread_id === undefined ||
          event.data.thread_id === conversationStore.threadId
        )
          workflow?.activeTab?.(event.data)
        return
      default:
        conversationStore.ingest(event)
    }
  }

  function onStatus(live: boolean): void {
    if (live) {
      void resyncDraft()
      return
    }
    conversationStore.abortActiveTurn()
    conversationStore.dropBackgroundTurns()
  }

  return {
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
