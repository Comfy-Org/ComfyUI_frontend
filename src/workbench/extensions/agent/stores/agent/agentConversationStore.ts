import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { TurnId } from '../../schemas/agentApiSchema'
import type {
  AgentChatEvent,
  AgentEventTransport
} from '../../services/agent/agentEventTransport'
import { createAgentEventTransport } from '../../services/agent/agentEventTransport'
import type { AssistantMessage } from '../../services/agent/agentMessageParts'
import { createAssistantMessage } from '../../services/agent/agentMessageParts'

export type ConversationStatus = 'idle' | 'thinking' | 'streaming'

// The user's own turn text. Recorded at send time (the event stream is assistant-only),
// paired to its assistant turn by the shared TurnId (the server-minted message_id).
interface UserEntry {
  id: TurnId
  role: 'user'
  text: string
}

// One rendered row of the conversation: the user's prompt or the assistant's reply.
// `role` discriminates (AssistantMessage carries role 'assistant').
export type ConversationEntry = UserEntry | AssistantMessage

/**
 * agentConversationStore - the message/turn list and streaming status the UI reads.
 *
 * ONE turn is in flight at a time: startTurn opens an assistant message and a transport
 * reducer bound to it; ingest folds turn-scoped chat events into that message;
 * done/abort settle it. The STORE owns turn-id filtering - ingest drops any event whose
 * data.message_id does not match the active turn (a stale/foreign turn's events must not
 * bleed into the current message). The transport trusts its input is already scoped.
 *
 * The message list holds a fresh message reference per emit (transport's snapshot), so
 * replacing the array slot trips Vue's reactivity and streaming deltas render live.
 */
export const useAgentConversationStore = defineStore(
  'agentConversation',
  () => {
    const messages = ref<AssistantMessage[]>([])
    const activeTurnId = ref<TurnId | null>(null)
    // The server thread this conversation belongs to; null until the first send's ack adopts
    // one. Held here, not in the session composable, so it survives a panel remount - a
    // reopened panel with a null thread would post to 'new' and split the persisted
    // transcript across two server threads.
    const threadId = ref<string | null>(null)
    // User prompt text keyed by turn id. The transport only produces assistant messages,
    // so the send path records the user's text here and the UI interleaves it before the
    // matching assistant turn.
    const userTexts = ref(new Map<TurnId, string>())

    let transport: AgentEventTransport | null = null
    // Index of the live assistant message so an emit replaces exactly that slot. Reactive
    // so activeMessage (and status/isStreaming) re-derive the instant a turn opens or
    // settles - a plain closure int would leave those computeds stale until the next
    // messages mutation, so an eager status read right after startTurn saw the old value.
    const activeIndex = ref(-1)

    function replaceActive(message: AssistantMessage): void {
      if (activeIndex.value >= 0) messages.value[activeIndex.value] = message
    }

    // Record the user's prompt for a turn so the UI can render it before the assistant
    // reply. Called by the send path just before startTurn.
    function recordUser(turnId: TurnId, text: string): void {
      userTexts.value.set(turnId, text)
    }

    function setThreadId(id: string | null): void {
      threadId.value = id
    }

    // Record a send that never reached the wire: keep the user's text and push a SETTLED
    // assistant message carrying an error notice, so the failed exchange renders through
    // the existing UserMessage + AgentMessage NoticePart paths. No transport is opened and
    // activeTurnId/activeIndex are untouched, so the in-flight turn (if any) is unaffected.
    function recordFailedSend(
      turnId: TurnId,
      text: string,
      noticeText: string
    ): void {
      userTexts.value.set(turnId, text)
      const message = createAssistantMessage(turnId)
      message.streaming = false
      message.parts = [{ type: 'notice', level: 'error', text: noticeText }]
      messages.value.push(message)
    }

    // Open a new assistant turn. A prior in-flight turn is aborted first so a dropped
    // reply can't leave two turns "live" at once.
    function startTurn(turnId: TurnId): void {
      if (transport) abortActiveTurn()
      const message = createAssistantMessage(turnId)
      activeIndex.value = messages.value.push(message) - 1
      activeTurnId.value = turnId
      transport = createAgentEventTransport(message, replaceActive)
    }

    // Fold one chat event into the active turn. Events for a foreign turn are dropped here
    // (the store owns turn filtering); every v1 chat event carries data.message_id, so
    // there is no absent-id case to guard. agent_message_done settles the turn (the v1
    // analog of the old reply frame): finalize with its usage, then clear the active turn.
    function ingest(event: AgentChatEvent): void {
      if (!transport) return
      if (event.data.message_id !== activeTurnId.value) return
      if (event.type === 'agent_message_done') {
        transport.finalize(event.data.usage)
        clearActive()
        return
      }
      transport.ingest(event)
    }

    // Settle the in-flight turn WITHOUT a done (socket drop mid-turn): close its open
    // blocks and drop the spinner in place, then clear the transport/activeTurnId so no
    // spinner is stuck forever. reset() (which wipes everything) is NOT a substitute.
    function abortActiveTurn(): void {
      if (!transport) return
      transport.abort()
      clearActive()
    }

    function clearActive(): void {
      transport = null
      activeIndex.value = -1
      activeTurnId.value = null
    }

    // Wipe the whole conversation (new session). Distinct from abortActiveTurn, which
    // only settles the current turn and preserves history.
    function reset(): void {
      messages.value = []
      userTexts.value = new Map()
      threadId.value = null
      clearActive()
    }

    // The ordered render list: each assistant turn preceded by its user prompt (when one
    // was recorded). Turns are strictly sequential, so pairing by turn id yields the true
    // chat order without a second index.
    const entries = computed<ConversationEntry[]>(() =>
      messages.value.flatMap((message) => {
        const text = userTexts.value.get(message.id)
        return text === undefined
          ? [message]
          : [{ id: message.id, role: 'user', text }, message]
      })
    )

    const activeMessage = computed(() =>
      activeIndex.value >= 0 ? messages.value[activeIndex.value] : null
    )
    const isStreaming = computed(() => activeMessage.value?.streaming ?? false)
    const status = computed<ConversationStatus>(() => {
      const message = activeMessage.value
      if (!message?.streaming) return 'idle'
      return message.thinking ? 'thinking' : 'streaming'
    })

    return {
      messages,
      entries,
      activeTurnId,
      threadId,
      isStreaming,
      status,
      recordUser,
      setThreadId,
      recordFailedSend,
      startTurn,
      ingest,
      abortActiveTurn,
      reset
    }
  }
)
