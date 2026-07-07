import { computed, ref } from 'vue'

import { i18n } from '../../i18n'
import type { TurnId } from '../../schemas/agentApiSchema'
import { isAgentEvent, parseAgentWsEvent } from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type { AgentRestClient } from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'

// Monotonic counter for LOCAL error-turn ids. These never go on the wire: a failed
// send has no server-minted message_id, so recordFailedSend needs a unique local key
// to slot the failed exchange into the conversation.
let localErrorCount = 0

function nextLocalErrorId(): TurnId {
  // A LOCAL id, never sent to the wire; the cast brands a client-only key.
  return `local-error-${++localErrorCount}` as TurnId
}

/**
 * useAgentSession - the v1 headless composition root of the In-App Agent panel.
 *
 * It wires the REST client, the WebSocket event stream, the conversation store, and the
 * draft store into the outbound UI surface the panel renders. Turns are addressed by the
 * server-minted assistant message_id (a TurnId): the panel no longer mints turn ids, it
 * adopts the id the POST 202 ack returns and carries it opaquely everywhere else.
 */

// The raw WebSocket surface the session subscribes to. Frames arrive as unknown (strings
// or already-parsed objects); onStatus reports socket liveness for reconnect recovery.
export interface AgentEventSource {
  subscribe(listener: (raw: unknown) => void): () => void
  onStatus?(listener: (live: boolean) => void): () => void
}

export interface SessionNotice {
  level: 'info' | 'warning' | 'error'
  text: string
}

export interface AgentSessionDeps {
  rest: AgentRestClient
  events: AgentEventSource
  workflowId?: () => string | undefined
  selection?: () => Record<string, unknown> | undefined
}

export function useAgentSession(deps: AgentSessionDeps) {
  const { rest, events, workflowId, selection } = deps

  const conversationStore = useAgentConversationStore()
  const draftStore = useAgentDraftStore()

  const notices = ref<SessionNotice[]>([])
  // The active thread; null until the first send's ack adopts one. A next send with null
  // posts to 'new', which opens a thread as part of posting the first message.
  const threadIdRef = ref<string | null>(null)
  // Single-flight guard so overlapping draft_version heartbeats collapse to one GET.
  let resyncing = false
  // Single-flight guard for sends: the POST 202 ack arrives before any socket frame, so
  // a second send fired in that window must not open a second wire turn.
  const sending = ref(false)

  let unsubscribe: (() => void) | null = null
  let unsubscribeStatus: (() => void) | null = null

  function pushError(text: string): void {
    notices.value.push({ level: 'error', text })
  }

  // Fetch the authoritative draft and adopt it into the draft store. Single-flight: a
  // second call while one is in flight is ignored. A 404 means no draft exists yet
  // (benign); any other AgentApiError surfaces as a notice.
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
      // Non-AgentApiError (network TypeError, zod drift): every caller voids this
      // promise, so a rethrow would escape as an unhandled rejection. Surface it.
      pushError(error instanceof Error ? error.message : String(error))
    } finally {
      resyncing = false
    }
  }

  function start(): void {
    unsubscribe = events.subscribe(onRaw)
    if (events.onStatus) unsubscribeStatus = events.onStatus(onStatus)
    const id = workflowId?.()
    if (id !== undefined) {
      draftStore.bind(id)
      // Baseline the draft on connect so a reconnect recovers versions missed offline.
      void resyncDraft()
    }
  }

  function stop(): void {
    unsubscribe?.()
    unsubscribeStatus?.()
    unsubscribe = null
    unsubscribeStatus = null
  }

  // Returns true on the ack path, false on every failure. Hosts may restore the
  // composer draft from a false return.
  async function sendMessage(
    text: string,
    attachments?: string[]
  ): Promise<boolean> {
    if (sending.value) {
      // Silent dropping is not allowed here: the composer already cleared the draft, so
      // a swallowed send would lose the user's text with no trace. Record it as failed.
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        i18n.global.t('agent.sendBusy')
      )
      return false
    }
    const id = workflowId?.()
    if (id !== undefined) draftStore.bind(id)
    sending.value = true
    try {
      const ack = await rest.postMessage(threadIdRef.value ?? 'new', {
        content: text,
        workflowId: id,
        selection: selection?.(),
        attachments
      })
      threadIdRef.value = ack.thread_id
      // The ONE branding seam: the server-minted assistant message_id becomes the TurnId
      // that addresses this turn everywhere downstream.
      const turnId = ack.message_id as TurnId
      conversationStore.recordUser(turnId, text)
      conversationStore.startTurn(turnId)
      return true
    } catch (error) {
      const message =
        error instanceof AgentApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error)
      pushError(message)
      // A failed send must not vanish: mint a LOCAL id (never sent to the wire) and
      // render the failed exchange through the existing user + notice paths.
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
    const threadId = threadIdRef.value
    const turnId = conversationStore.activeTurnId
    if (threadId === null || turnId === null) return
    try {
      await rest.cancelMessage(threadId, turnId)
    } catch (error) {
      if (error instanceof AgentApiError) {
        // A 409 means the turn already settled server-side (benign). The terminal delta
        // ('Stopped at your request.') and done still arrive over the socket, so do NOT
        // locally abort here.
        if (error.status === 409) return
        pushError(error.message)
        return
      }
      // Non-AgentApiError: the caller voids this promise, so surface rather than
      // rethrow into an unhandled rejection.
      pushError(error instanceof Error ? error.message : String(error))
    }
  }

  function newChat(): void {
    // Cancel any in-flight turn first: an abandoned turn keeps generating and billing
    // server-side unless cancelled. stopTurn captures threadId + activeTurnId
    // synchronously at entry, so the reset below cannot race the read.
    void stopTurn()
    conversationStore.reset()
    threadIdRef.value = null
  }

  function onRaw(raw: unknown): void {
    const value = typeof raw === 'string' ? tryParseJson(raw) : raw
    if (value === undefined) return
    if (typeof value !== 'object' || value === null) return
    const type = (value as { type?: unknown }).type
    // Host /ws noise (e.g. status frames) rides the same socket; sort agent events off
    // the type string before paying for a full zod parse.
    if (typeof type !== 'string' || !isAgentEvent(type)) return
    const parsed = parseAgentWsEvent(value)
    if (!parsed.success) {
      // A malformed agent_message_done for OUR active turn (or one with no readable
      // message_id) must still settle the turn, or the spinner hangs forever. A readable
      // FOREIGN message_id is ignored: another tab's drifted done must not abort our turn.
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
        // Draft events are NEVER turn-filtered: the draft is shared workflow state, not
        // turn-scoped, so an out-of-turn patch must still be adopted.
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
    // Socket dropped: settle the in-flight turn so no spinner is stuck. Recovered:
    // resync the draft to recover any draft_patches missed while offline.
    if (live) void resyncDraft()
    else conversationStore.abortActiveTurn()
  }

  return {
    start,
    stop,
    sendMessage,
    stopTurn,
    newChat,
    entries: computed(() => conversationStore.entries),
    status: computed(() => conversationStore.status),
    isStreaming: computed(() => conversationStore.isStreaming),
    notices: computed(() => notices.value),
    threadId: computed(() => threadIdRef.value)
  }
}

export type AgentSession = ReturnType<typeof useAgentSession>

// Guarded JSON.parse for string frames; non-JSON strings are ignored (return undefined).
function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}
