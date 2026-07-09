import { computed, ref } from 'vue'

import { i18n } from '@/i18n'
import type { TurnId } from '../../schemas/agentApiSchema'
import { isAgentEvent, parseAgentWsEvent } from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  WorkflowUpload
} from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'

// Headless composition root. Turns are addressed by the server-minted assistant
// message_id from the send ack; the panel never mints turn ids.

export interface AgentEventSource {
  subscribe(listener: (raw: unknown) => void): () => void
  onStatus?(listener: (live: boolean) => void): () => void
}

export interface SessionNotice {
  level: 'info' | 'warning' | 'error'
  text: string
}

// A settled upload: the server ref rides the POST, name + preview stay behind
// on the transcript's user entry.
interface SentAttachment {
  ref: string
  name: string
  previewUrl?: string
}

// A consumed @-tag: the node id rides the POST selection, the title stays
// behind on the transcript's user entry. The id resolves against the graph
// uploaded with the same POST (workflow.graph).
interface SentTag {
  id: string
  title: string
}

// The active tab resolved for a turn. `speculative` marks an id the server has
// not confirmed owning; a 403 on it retries the send once without the id.
export interface WorkflowTurnContext {
  id: string
  speculative: boolean
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
    // The canvas snapshot to seed the server draft with, or undefined when
    // unchanged since the last upload.
    snapshot?(): WorkflowUpload | undefined
  }
}

const THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'

export function useAgentSession(deps: AgentSessionDeps) {
  const { rest, events, workflow } = deps

  const conversationStore = useAgentConversationStore()
  const draftStore = useAgentDraftStore()

  const notices = ref<SessionNotice[]>([])
  let resyncing = false
  // The 202 ack races the socket frames; a second send in that window must not open a
  // second wire turn.
  const sending = ref(false)

  // Local-only turn ids for failed sends, which have no server-minted message_id.
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
      // A rebind during the fetch must not adopt the stale workflow's draft.
      if (draftStore.workflowId === id) draftStore.adoptSnapshot(snapshot)
    } catch (error) {
      if (error instanceof AgentApiError) {
        if (error.status === 404) return
        pushError(error.message)
        return
      }
      // Callers void this promise; surface instead of an unhandled rejection.
      pushError(error instanceof Error ? error.message : String(error))
    } finally {
      resyncing = false
    }
  }

  function start(): void {
    unsubscribe = events.subscribe(onRaw)
    if (events.onStatus) unsubscribeStatus = events.onStatus(onStatus)
    // A same-page reopen already has the conversation in the store; only a fresh page
    // restores the persisted thread.
    if (
      conversationStore.threadId === null &&
      conversationStore.messages.length === 0
    ) {
      const stored = localStorage.getItem(THREAD_STORAGE_KEY)
      if (stored !== null) {
        conversationStore.setThreadId(stored)
        void hydrateFromServer(stored)
      }
    }
  }

  // A 404 means the thread expired or was deleted: forget the stale id, not an error.
  async function hydrateFromServer(threadId: string): Promise<void> {
    try {
      const history = await rest.getMessages(threadId)
      // newChat may have replaced the thread while the fetch was in flight.
      if (conversationStore.threadId === threadId)
        conversationStore.hydrate(history)
    } catch (error) {
      if (error instanceof AgentApiError && error.status === 404) {
        if (conversationStore.threadId === threadId)
          conversationStore.setThreadId(null)
        localStorage.removeItem(THREAD_STORAGE_KEY)
        return
      }
      pushError(error instanceof Error ? error.message : String(error))
    }
  }

  function stop(): void {
    unsubscribe?.()
    unsubscribeStatus?.()
    unsubscribe = null
    unsubscribeStatus = null
  }

  // False on any failure; hosts may restore the composer draft from it.
  async function sendMessage(
    text: string,
    attachments?: SentAttachment[],
    tags?: SentTag[]
  ): Promise<boolean> {
    if (sending.value) {
      // The composer already cleared its draft; a silently dropped send loses the text.
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        i18n.global.t('agent.sendBusy')
      )
      return false
    }
    sending.value = true
    const wfContext = workflow?.current()
    const upload = workflow?.snapshot?.()
    const input = {
      content: text,
      selection:
        tags !== undefined && tags.length > 0
          ? { node_ids: tags.map((tag) => tag.id) }
          : undefined,
      attachments: attachments?.map((attachment) => attachment.ref),
      workflow: upload
    }
    async function postTurn(threadId: string) {
      try {
        return await rest.postMessage(
          threadId,
          wfContext ? { ...input, workflowId: wfContext.id } : input
        )
      } catch (error) {
        const speculativeDenied =
          wfContext?.speculative === true &&
          error instanceof AgentApiError &&
          error.status === 403
        if (!speculativeDenied) throw error
        return await rest.postMessage(threadId, input)
      }
    }
    try {
      const ack = await postTurn(conversationStore.threadId ?? 'new')
      conversationStore.setThreadId(ack.thread_id)
      localStorage.setItem(THREAD_STORAGE_KEY, ack.thread_id)
      if (ack.workflow_id !== undefined) {
        draftStore.bind(ack.workflow_id)
        workflow?.adopted(ack.workflow_id, wfContext, upload !== undefined)
      }
      // The ONE branding seam: the server-minted message_id becomes the TurnId.
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
      // Inline row only: a toast would double-surface this and overlap the docked panel.
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
        // 409 = already settled server-side; the socket still delivers the terminal
        // delta + done, so no local abort.
        if (error.status === 409) return
        pushError(error.message)
        return
      }
      pushError(error instanceof Error ? error.message : String(error))
    }
  }

  function newChat(): void {
    // Cancel first: an abandoned turn keeps generating and billing. stopTurn reads its
    // ids synchronously, so the reset below cannot race it.
    void stopTurn()
    conversationStore.reset()
    // A late patch or resync for the abandoned thread's workflow must not land here.
    draftStore.reset()
    localStorage.removeItem(THREAD_STORAGE_KEY)
  }

  function listThreads() {
    return rest.listThreads()
  }

  async function loadThread(threadId: string): Promise<void> {
    void stopTurn()
    // The switched-to thread's workflow binds on its next ack; drop the old one.
    draftStore.reset()
    conversationStore.setThreadId(threadId)
    localStorage.setItem(THREAD_STORAGE_KEY, threadId)
    await hydrateFromServer(threadId)
  }

  function onRaw(raw: unknown): void {
    const value = typeof raw === 'string' ? tryParseJson(raw) : raw
    if (value === undefined) return
    if (typeof value !== 'object' || value === null) return
    const type = (value as { type?: unknown }).type
    // Host /ws noise rides the same socket; gate on type before paying for a zod parse.
    if (typeof type !== 'string' || !isAgentEvent(type)) return
    const parsed = parseAgentWsEvent(value)
    if (!parsed.success) {
      // A malformed done for OUR turn must still settle it (or the spinner hangs);
      // a readable FOREIGN message_id must not abort our turn.
      const messageId = (value as { data?: { message_id?: unknown } }).data
        ?.message_id
      if (
        type === 'agent_message_done' &&
        (typeof messageId !== 'string' ||
          messageId === conversationStore.activeTurnId)
      ) {
        conversationStore.abortActiveTurn()
        pushError(i18n.global.t('agent.malformedEvent'))
      }
      console.warn('[agent] dropping malformed agent event', parsed.error)
      return
    }
    const event = parsed.data
    switch (event.type) {
      case 'draft_patch':
        // Drafts are shared workflow state, never turn-filtered.
        draftStore.applyPatch(event.data)
        return
      case 'draft_version':
        if (draftStore.checkHeartbeat(event.data) === 'behind')
          void resyncDraft()
        return
      default:
        conversationStore.ingest(event)
    }
  }

  function onStatus(live: boolean): void {
    // Drop: settle the turn so no spinner hangs. Recover: resync missed draft patches.
    if (live) void resyncDraft()
    else conversationStore.abortActiveTurn()
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

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}
