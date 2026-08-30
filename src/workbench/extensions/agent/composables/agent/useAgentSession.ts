import { computed, ref } from 'vue'

import { i18n } from '@/i18n'
import type { AgentActiveTabData, TurnId } from '../../schemas/agentApiSchema'
import { isAgentEvent, parseAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentEventSource } from '../../services/agent/agentEventSource'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftUpload,
  OpenTabsSnapshot
} from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'
import {
  THREAD_STORAGE_KEY,
  forgetAgentSessionMemory
} from './agentSessionMemory'

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

const PREPARE_TIMEOUT_MS = 3000

let sessionGeneration = 0

/**
 * App-lifetime error-id mint: the ids land in an app-scoped store, so an
 * instance-scoped counter would re-mint duplicates across a remount.
 */
let localErrorCount = 0

export function useAgentSession(deps: AgentSessionDeps) {
  const { rest, events, workflow } = deps

  const conversationStore = useAgentConversationStore()
  const draftStore = useAgentDraftStore()

  const notices = ref<SessionNotice[]>([])
  const promptEditState = ref<PromptEditState>({ phase: 'idle' })
  let resyncing = false
  const sending = ref(false)

  function nextLocalErrorId(): TurnId {
    return `local-error-${++localErrorCount}` as TurnId
  }

  let unsubscribe: (() => void) | null = null
  let unsubscribeStatus: (() => void) | null = null
  let ownedGeneration = 0

  function pushError(text: string): void {
    notices.value.push({ level: 'error', text })
  }

  function storageGet(): string | null {
    try {
      return localStorage.getItem(THREAD_STORAGE_KEY)
    } catch {
      return null
    }
  }
  function storageSet(value: string): void {
    try {
      localStorage.setItem(THREAD_STORAGE_KEY, value)
    } catch (error) {
      console.warn('[agent] failed to persist the thread id', error)
    }
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
    ownedGeneration = ++sessionGeneration
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
    if (conversationStore.messages.length === 0) {
      const stored = storageGet()
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
      const resetOwned =
        resetOnFailure && conversationStore.threadId === threadId
      if (error instanceof AgentApiError && error.status === 404) {
        if (resetOwned) {
          conversationStore.stashActiveTurn()
          conversationStore.reset()
        } else if (conversationStore.threadId === threadId)
          conversationStore.setThreadId(null)
        forgetAgentSessionMemory()
        return false
      }
      pushError(error instanceof Error ? error.message : String(error))
      if (resetOwned) {
        conversationStore.stashActiveTurn()
        conversationStore.reset()
        forgetAgentSessionMemory()
      }
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
    let upload: DraftUpload | undefined
    let tabs: OpenTabsSnapshot | undefined
    let uploaded: boolean
    const destinationThread = conversationStore.threadId ?? 'new'
    const initiatingGeneration = loadGeneration
    const initiatingOwner = ownedGeneration
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
        upload = workflow?.snapshot?.()
        tabs = workflow?.tabs?.()
        uploaded = upload !== undefined
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
        return true
      }
      conversationStore.setThreadId(ack.thread_id)
      conversationStore.recordUser(turnId, text, sentAttachments, sentTags)
      conversationStore.startTurn(turnId)
      if (ack.workflow_id !== undefined) draftStore.bind(ack.workflow_id)
      storageSet(ack.thread_id)
      try {
        if (ack.workflow_id !== undefined)
          workflow?.adopted(ack.workflow_id, wfContext, uploaded)
      } catch (error) {
        // Consumer bookkeeping cannot retract an accepted turn.
        console.warn('[agent] workflow.adopted consumer threw', error)
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

  let loadGeneration = 0

  function newChat(): void {
    loadGeneration++
    promptEditState.value = { phase: 'idle' }
    conversationStore.stashActiveTurn()
    conversationStore.reset()
    draftStore.reset()
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
    draftStore.reset()
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
    if (ownedGeneration !== sessionGeneration) return
    if (live) {
      void resyncDraft()
      return
    }
    conversationStore.abortActiveTurn()
    conversationStore.dropBackgroundTurns()
  }

  const isSending = computed(() => sending.value)
  const editableTurnId = computed(() =>
    promptEditState.value.phase === 'ready'
      ? promptEditState.value.turnId
      : null
  )

  return {
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
