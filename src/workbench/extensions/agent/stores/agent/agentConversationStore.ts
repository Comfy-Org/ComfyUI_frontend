import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import type {
  AgentChatEvent,
  AgentEventTransport
} from '../../services/agent/agentEventTransport'
import { createAgentEventTransport } from '../../services/agent/agentEventTransport'
import type { AssistantMessage } from '../../services/agent/agentMessageParts'
import { createAssistantMessage } from '../../services/agent/agentMessageParts'
import { normalizeAgentTranscript } from '../../services/agent/agentTranscript'
import type { UserAttachment } from '../../services/agent/agentTranscript'
import type { WorkflowReference } from '../../types/workflowReference'

export type { UserAttachment }

type ConversationStatus = 'idle' | 'thinking' | 'streaming'

export type AskSelection = 'run' | 'cancel'

interface UserEntry {
  id: TurnId
  role: 'user'
  text: string
  attachments?: UserAttachment[]
  tags?: string[]
  workflowReferences?: WorkflowReference[]
}

export type ConversationEntry = UserEntry | AssistantMessage

interface BackgroundTurn {
  messageId: TurnId
  message: AssistantMessage
  transport: AgentEventTransport
  userText: string | undefined
  settled: boolean
}

/**
 * PM-1658: how long an accepted answer waits for its `agent_ask_resolved`
 * frame before the card is retired anyway. Generous, because the frame is the
 * normal release and arrives in milliseconds; it exists only so a lost frame
 * cannot leave the card disabled for the rest of the session.
 */
const ASK_RESOLUTION_GRACE_MS = 15_000

export const useAgentConversationStore = defineStore(
  'agentConversation',
  () => {
    const messages = ref<AssistantMessage[]>([])
    const activeTurnId = ref<TurnId | null>(null)
    const threadId = ref<string | null>(null)
    const userTexts = ref(new Map<TurnId, string>())
    const userAttachments = ref(new Map<TurnId, UserAttachment[]>())
    const userTags = ref(new Map<TurnId, string[]>())
    const userWorkflowReferences = ref(new Map<TurnId, WorkflowReference[]>())
    const latestWorkflowId = ref<string>()
    let transport: AgentEventTransport | null = null
    let liveMessage: AssistantMessage | null = null
    // PM-1575: whether a newly-created transport should hold a tool-call's
    // chat "done" state back until canvas catch-up is confirmed (see
    // agentEventTransport.ts). Defaults to never deferring, so a caller that
    // never registers a gate (e.g. a headless/non-canvas conversation) keeps
    // the pre-fix, immediate-done behavior. Read indirectly (via a wrapping
    // closure, never passed by value) everywhere it is handed to a
    // transport, so a later setCanvasSyncGate() call reaches transports
    // that already exist -- passing the variable itself would freeze each
    // transport onto whichever function this variable held at its own
    // creation time.
    let canvasSyncGate: () => boolean = () => false
    // PM-1575: mirrors canvasSyncGate above, for the monotonic doc-update
    // outcome counter a transport compares its per-tool-call baseline
    // against (agentEventTransport.ts's canvasSyncBaseline). Same
    // read-indirectly rule applies.
    let canvasSyncOutcomeCount: () => number = () => 0
    // PM-1575: settled turns (agent_message_done already applied) whose
    // transport is still holding at least one tool-call part back pending
    // canvas catch-up. clearActive() drops the `transport` slot the moment a
    // turn settles, same as it always has, so without this a settled
    // transport becomes unreachable and notifyCanvasCaughtUp() below can
    // never deliver the catch-up signal it is waiting for -- the part would
    // then only ever settle via its own STALE_AFTER_MS fallback. A Set, not
    // a single slot: a single slot lets turn B's settle overwrite turn A's
    // entry while A is still holding a part, stranding A the same way. Each
    // entry prunes itself out the first time notifyCanvasCaughtUp() finds it
    // has nothing left pending.
    const settledActiveTransports = new Set<AgentEventTransport>()
    const backgroundTurns = new Map<string, BackgroundTurn>()
    let hydratedMessageIds = new Set<string>()
    let hydratedAssistantTurnIds = new Set<TurnId>()
    const activeIndex = ref(-1)

    function replaceActive(message: AssistantMessage): void {
      // PM-1575: looked up by id, not `activeIndex.value`. A turn's own
      // transport keeps emitting after settle -- notifyCanvasCaughtUp() can
      // still land on it while a tool-call part is held pending canvas
      // catch-up (see settledActiveTransports below) -- and by then
      // clearActive() has already reset activeIndex.value to -1, even though
      // the settled message is still sitting in `messages` at its own slot.
      const index = messages.value.findIndex((m) => m.id === message.id)
      if (index >= 0) messages.value[index] = message
    }

    function recordUser(
      turnId: TurnId,
      text: string,
      attachments?: UserAttachment[],
      tags?: string[],
      workflowReferences?: WorkflowReference[]
    ): void {
      userTexts.value.set(turnId, text)
      if (attachments !== undefined && attachments.length > 0)
        userAttachments.value.set(turnId, attachments)
      if (tags !== undefined && tags.length > 0)
        userTags.value.set(turnId, tags)
      if (workflowReferences !== undefined && workflowReferences.length > 0)
        userWorkflowReferences.value.set(turnId, workflowReferences)
    }

    function setThreadId(id: string | null): void {
      threadId.value = id
    }

    function recordSettledReply(
      turnId: TurnId,
      text: string,
      parts: AssistantMessage['parts']
    ): void {
      userTexts.value.set(turnId, text)
      const message = createAssistantMessage(turnId)
      message.streaming = false
      message.parts = parts
      messages.value.push(message)
    }

    function recordFailedSend(
      turnId: TurnId,
      text: string,
      noticeText: string,
      retryAfterSeconds?: number
    ): void {
      recordSettledReply(turnId, text, [
        { type: 'notice', level: 'error', text: noticeText, retryAfterSeconds }
      ])
    }

    function recordPaywall(
      turnId: TurnId,
      text: string,
      message?: string
    ): void {
      recordSettledReply(turnId, text, [{ type: 'paywall', message }])
    }

    function resolvePaywalls(): void {
      messages.value = messages.value.map((message) => {
        const parts = message.parts.filter((part) => part.type !== 'paywall')
        return parts.length === message.parts.length
          ? message
          : { ...message, parts }
      })
    }

    function setPaywallsResolved(resolved: boolean): void {
      if (resolved) resolvePaywalls()
    }

    /**
     * PM-1658: retires a run-approval card that must never be offered again,
     * the way an `agent_ask_resolved` frame would. `ingest` cannot serve this:
     * it routes only to the active turn, and the cases this exists for are
     * exactly the ones where that turn is gone. Every holder of the message
     * has to be told, or whichever one is asked to republish next puts the
     * card back.
     */
    function retireAsk(askId: string): void {
      const withoutAsk = (parts: AssistantMessage['parts']) =>
        parts.filter(
          (part) => part.type !== 'runApproval' || part.askId !== askId
        )
      messages.value = messages.value.map((message) => {
        const parts = withoutAsk(message.parts)
        return parts.length === message.parts.length
          ? message
          : { ...message, parts }
      })
      transport?.dropAskPart(askId)
      for (const settledTransport of settledActiveTransports)
        settledTransport.dropAskPart(askId)
      // Stashed turns are the one holder that can belong to another thread,
      // and retiring this thread's ask is no business of theirs. The active
      // and settled transports need no such guard: hydrate disposes both on
      // every thread switch.
      for (const [owner, entry] of backgroundTurns)
        if (owner === threadId.value) entry.transport.dropAskPart(askId)
      retiredAsksForCurrentThread().add(askId)
      clearAskResolutionWatchdog(askId)
      submittedAskSelections.delete(askId)
      setAskAnswering(askId, false)
    }

    /**
     * PM-1658: asks this client has retired, per owning thread. `hydrate()`
     * rebuilds a card from the server's `pending_ask`, which still reads
     * pending while an answer is in flight and after a resolution broadcast is
     * lost, so a refetch would otherwise put an answered card back on screen
     * ENABLED — and the server answers the second, contradictory click by
     * replaying the FIRST selection. Survives a remount because the store
     * does; pruned once the thread's own transcript stops naming the ask.
     *
     * Keyed by thread so that loading another one cannot prune these, and so
     * nothing here rests on an ask id being unique across threads.
     */
    const resolvedAskIds = new Map<string, Set<string>>()

    function retiredAsksForCurrentThread(): Set<string> {
      const key = threadId.value ?? ''
      const retired = resolvedAskIds.get(key) ?? new Set<string>()
      resolvedAskIds.set(key, retired)
      return retired
    }
    /**
     * PM-1658: which way this client answered each ask. The server takes a
     * second answer from anywhere with 202 while committing only the FIRST, so
     * without a record of what we sent, a resolution naming someone else's
     * choice is indistinguishable from confirmation of our own.
     */
    const submittedAskSelections = new Map<string, AskSelection>()

    function recordAskSelection(askId: string, selection: AskSelection): void {
      submittedAskSelections.set(askId, selection)
    }

    function submittedAskSelection(askId: string): AskSelection | undefined {
      return submittedAskSelections.get(askId)
    }

    const askResolutionWatchdogs = new Map<
      string,
      ReturnType<typeof setTimeout>
    >()

    function clearAskResolutionWatchdog(askId: string): void {
      const timer = askResolutionWatchdogs.get(askId)
      if (timer === undefined) return
      clearTimeout(timer)
      askResolutionWatchdogs.delete(askId)
    }

    /**
     * PM-1658: the answers the server has accepted, whose card is still held
     * disabled waiting on the resolution frame. Kept apart from the ones still
     * in flight because the two cannot be recovered the same way — the server
     * replays the STORED selection for any repeat answer, so re-offering a
     * committed card takes a second click and discards it while looking like
     * it landed. Lives here rather than in the session composable so a panel
     * remount cannot lose it and re-enable the card.
     */
    const committedAskIds = new Set<string>()
    const answeringAskIds = ref<ReadonlySet<string>>(new Set())

    function setAskAnswering(askId: string, answering: boolean): void {
      const next = new Set(answeringAskIds.value)
      if (answering) next.add(askId)
      else {
        next.delete(askId)
        committedAskIds.delete(askId)
      }
      answeringAskIds.value = next
    }

    /**
     * Records that the server accepted this answer. A card whose turn is still
     * attached keeps waiting for the canonical frame; a detached one has none
     * coming, so it is retired now.
     *
     * The wait is bounded either way. A frame can be lost outright, and a turn
     * re-adopted by `hydrate` between the click and the response looks
     * attached while owning no socket that will ever deliver one — both leave
     * the card disabled with nothing to release it.
     */
    function commitAsk(askId: string): void {
      committedAskIds.add(askId)
      if (!activeTurnOwnsAsk(askId)) {
        retireAsk(askId)
        return
      }
      clearAskResolutionWatchdog(askId)
      askResolutionWatchdogs.set(
        askId,
        setTimeout(() => retireAsk(askId), ASK_RESOLUTION_GRACE_MS)
      )
    }

    /**
     * PM-1658: the socket carrying every pending resolution frame has gone, so
     * accepted answers will never be released by one. Retire their cards
     * rather than re-offer them. Answers still in flight keep their card
     * disabled on purpose — their own response, or `answerAsk`'s deadline,
     * settles those.
     */
    function dismissCommittedAsks(): void {
      const committed = Array.from(committedAskIds)
      committedAskIds.clear()
      for (const askId of committed) retireAsk(askId)
    }

    function startTurn(turnId: TurnId): void {
      if (transport) abortActiveTurn()
      const message = createAssistantMessage(turnId)
      liveMessage = message
      activeTurnId.value = turnId
      activeIndex.value = messages.value.push(message) - 1
      transport = createAgentEventTransport(
        message,
        replaceActive,
        () => canvasSyncGate(),
        () => canvasSyncOutcomeCount()
      )
    }

    function ingest(event: AgentChatEvent): void {
      const activeTransport = transport
      if (activeTransport && event.data.message_id === activeTurnId.value) {
        ingestActiveTurnEvent(event, activeTransport)
        return
      }
      const eventThreadId = event.data.thread_id
      // agent_active_tab is the one event whose message_id is optional; without
      // it the thread is the only routing key left.
      if (
        event.type === 'agent_active_tab' &&
        event.data.message_id === undefined
      ) {
        ingestActiveTabEvent(event, eventThreadId)
        return
      }
      if (eventThreadId === undefined) return
      ingestBackgroundTurnEvent(event, eventThreadId)
    }

    function ingestActiveTurnEvent(
      event: AgentChatEvent,
      activeTransport: AgentEventTransport
    ): void {
      if (event.type === 'agent_message_done') {
        settleActiveTurn(activeTransport)
        return
      }
      activeTransport.ingest(event)
    }

    // PM-1575: capture the transport before clearActive() drops the
    // `transport` slot, so notifyCanvasCaughtUp() can still reach it while a
    // tool-call part is held pending canvas catch-up (see
    // settledActiveTransports above). Only kept around when it actually has
    // something pending -- a settled transport with nothing held has no
    // reason to stay reachable.
    function settleActiveTurn(activeTransport: AgentEventTransport): void {
      activeTransport.settle()
      if (activeTransport.hasPendingCanvasSync())
        settledActiveTransports.add(activeTransport)
      clearActive()
    }

    function ingestActiveTabEvent(
      event: AgentChatEvent,
      eventThreadId: string | undefined
    ): void {
      if (eventThreadId === undefined || eventThreadId === threadId.value)
        transport?.ingest(event)
      else backgroundTurns.get(eventThreadId)?.transport.ingest(event)
    }

    function ingestBackgroundTurnEvent(
      event: AgentChatEvent,
      eventThreadId: string
    ): void {
      const entry = backgroundTurns.get(eventThreadId)
      if (!entry || entry.messageId !== event.data.message_id) return
      if (event.type === 'agent_message_done') {
        entry.transport.settle()
        entry.settled = true
        return
      }
      entry.transport.ingest(event)
    }

    function setCanvasSyncGate(
      gate: () => boolean,
      outcomeCount: () => number = () => 0
    ): void {
      canvasSyncGate = gate
      canvasSyncOutcomeCount = outcomeCount
    }

    /**
     * PM-1575: forwarded to every live transport (the active turn and any
     * stashed background ones) whenever the bound workflow's CRDT follower
     * applies a fresh doc update, so tool-call parts held back pending canvas
     * catch-up can settle to 'done'. A no-op on a transport with nothing
     * pending.
     */
    function notifyCanvasCaughtUp(): void {
      transport?.notifyCanvasCaughtUp()
      for (const settledTransport of settledActiveTransports) {
        settledTransport.notifyCanvasCaughtUp()
        if (!settledTransport.hasPendingCanvasSync())
          settledActiveTransports.delete(settledTransport)
      }
      for (const entry of backgroundTurns.values())
        entry.transport.notifyCanvasCaughtUp()
    }

    function abortActiveTurn(): void {
      if (!transport) return
      transport.settle()
      // Not `settledActiveTransports`: an abort is not a natural completion
      // whose held parts might still catch up, so flush them to `done` and
      // cancel their timers now rather than leaving them reachable only by
      // their own STALE_AFTER_MS fallback (or, worse, orphaned).
      transport.dispose()
      clearActive()
    }

    function stashActiveTurn(): void {
      if (!transport || liveMessage === null) return
      if (threadId.value === null || activeTurnId.value === null) {
        abortActiveTurn()
        return
      }
      backgroundTurns.set(threadId.value, {
        messageId: activeTurnId.value,
        message: liveMessage,
        transport,
        userText: userTexts.value.get(liveMessage.id),
        settled: false
      })
      clearActive()
    }

    function resumeBackgroundTurn(): void {
      if (threadId.value === null) return
      const entry = backgroundTurns.get(threadId.value)
      if (!entry) return
      backgroundTurns.delete(threadId.value)
      // The stash keys a turn by its message_id while hydrate() re-keys the same
      // turn by the server's turn_id; row.id bridges the two. Matching turns by
      // identity, not by shared user text, is what stops a repeated prompt from
      // colliding with an unrelated turn.
      const kept = messages.value.filter((m) => m.id !== entry.message.id)
      const poppedHydratedCopy = removeHydratedCopy(entry, kept)
      if (
        entry.settled &&
        !poppedHydratedCopy &&
        hydratedMessageIds.has(entry.messageId)
      ) {
        // The persisted, authoritative copy is already on screen (kept, via
        // the filter above) -- this entry's transport is now discarded for
        // good, so flush anything it is still holding rather than leaving it
        // unreachable until its own STALE_AFTER_MS fallback.
        entry.transport.dispose()
        return
      }
      if (
        entry.userText !== undefined &&
        !userTexts.value.has(entry.message.id)
      )
        userTexts.value.set(entry.message.id, entry.userText)
      const index = kept.push(entry.message) - 1
      messages.value = kept
      if (entry.settled) {
        // PM-1575: this settled turn is kept on screen but not reactivated --
        // its transport is discarded for good right after this, same as the
        // hydrated-copy-dropped branch above, so flush anything it is still
        // holding rather than leaving it unreachable until its own
        // STALE_AFTER_MS fallback.
        entry.transport.dispose()
        return
      }
      activeTurnId.value = entry.messageId
      activeIndex.value = index
      transport = entry.transport
      liveMessage = entry.message
    }

    function removeHydratedCopy(
      entry: BackgroundTurn,
      kept: AssistantMessage[]
    ): boolean {
      if (kept.length !== messages.value.length) return false
      const last = kept.at(-1)
      if (!last || hydratedAssistantTurnIds.has(last.id)) return false
      if (
        entry.userText === undefined ||
        userTexts.value.get(last.id) !== entry.userText
      )
        return false
      kept.pop()
      userTexts.value.delete(last.id)
      return true
    }

    function settleBackgroundTurn(turnId: string): void {
      for (const [key, entry] of backgroundTurns) {
        if (entry.messageId !== turnId) continue
        entry.transport.settle()
        // This turn is being dropped from the map here, unlike the
        // agent_message_done path in ingestBackgroundTurnEvent -- nothing
        // will keep it reachable afterwards, so flush its held parts now.
        entry.transport.dispose()
        backgroundTurns.delete(key)
        return
      }
    }

    function dropBackgroundTurns(): void {
      for (const entry of backgroundTurns.values()) {
        entry.transport.settle()
        entry.transport.dispose()
      }
      backgroundTurns.clear()
    }

    function clearActive(): void {
      transport = null
      liveMessage = null
      activeIndex.value = -1
      activeTurnId.value = null
    }

    // PM-1575: reset() and hydrate() both discard the active transport (if
    // any) and every settled-but-still-holding one outright, with no
    // background-turn stash to keep them reachable through. Without
    // disposing them first, an orphaned STALE_AFTER_MS timer can fire later
    // and write a stale snapshot back over transcript content hydrate() has
    // since replaced under the same turn id.
    function disposeActiveAndSettledTransports(): void {
      transport?.dispose()
      for (const settledTransport of settledActiveTransports)
        settledTransport.dispose()
      settledActiveTransports.clear()
    }

    function dropAttachmentPreviews(): void {
      for (const attachments of userAttachments.value.values()) {
        for (const { previewUrl } of attachments) {
          if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
        }
      }
      userAttachments.value = new Map()
    }

    function reset(): void {
      disposeActiveAndSettledTransports()
      messages.value = []
      userTexts.value = new Map()
      userTags.value = new Map()
      userWorkflowReferences.value = new Map()
      latestWorkflowId.value = undefined
      dropAttachmentPreviews()
      threadId.value = null
      hydratedMessageIds = new Set()
      hydratedAssistantTurnIds = new Set()
      clearActive()
    }

    /**
     * PM-1658: strips cards this client has already retired from a freshly
     * fetched transcript, and forgets ids the server no longer names so the
     * record cannot grow without bound. Touches parts only — the turn that
     * raised the card is left exactly as the transcript describes it.
     */
    function dropResolvedAsks(
      transcript: ReturnType<typeof normalizeAgentTranscript>
    ): void {
      const retired = retiredAsksForCurrentThread()
      if (retired.size === 0) return
      const named = new Set(
        transcript.messages.flatMap((message) =>
          message.parts.flatMap((part) =>
            part.type === 'runApproval' ? [part.askId] : []
          )
        )
      )
      for (const askId of retired) if (!named.has(askId)) retired.delete(askId)
      for (const message of transcript.messages)
        message.parts = message.parts.filter(
          (part) => part.type !== 'runApproval' || !retired.has(part.askId)
        )
    }

    function hydrate(history: AgentMessages): void {
      disposeActiveAndSettledTransports()
      clearActive()
      const transcript = normalizeAgentTranscript(history)
      // Only the card is retired, never the turn: answering it is what lets
      // the turn RESUME, so it is still live and still needs a transport, or
      // every frame of the rest of it is dropped and the row stays "Working…"
      // with nothing able to settle it.
      dropResolvedAsks(transcript)
      messages.value = transcript.messages
      userTexts.value = transcript.userTexts
      userTags.value = new Map()
      userWorkflowReferences.value = transcript.userWorkflowReferences
      latestWorkflowId.value = transcript.latestWorkflowId
      hydratedMessageIds = transcript.rowIds
      hydratedAssistantTurnIds = transcript.assistantTurnIds
      dropAttachmentPreviews()
      userAttachments.value = transcript.userAttachments
      if (transcript.pending) {
        liveMessage = transcript.pending.message
        activeTurnId.value = transcript.pending.messageId
        activeIndex.value = messages.value.indexOf(transcript.pending.message)
        transport = createAgentEventTransport(
          transcript.pending.message,
          replaceActive,
          () => canvasSyncGate(),
          () => canvasSyncOutcomeCount()
        )
      }
    }

    const entries = computed<ConversationEntry[]>(() =>
      messages.value.flatMap((message) => {
        const text = userTexts.value.get(message.id)
        return text === undefined
          ? [message]
          : [
              {
                id: message.id,
                role: 'user',
                text,
                attachments: userAttachments.value.get(message.id),
                tags: userTags.value.get(message.id),
                workflowReferences: userWorkflowReferences.value.get(message.id)
              },
              message
            ]
      })
    )

    const activeMessage = computed(() =>
      activeIndex.value >= 0 ? messages.value[activeIndex.value] : null
    )
    /**
     * PM-1658: whether the live turn still owns this ask, i.e. whether an
     * `agent_ask_resolved` frame for it has a transport to route through.
     * False once a socket drop or a newer turn has detached the message the
     * card sits on — which is when a caller has to resolve it itself.
     */
    function activeTurnOwnsAsk(askId: string): boolean {
      return (
        activeMessage.value?.parts.some(
          (part) => part.type === 'runApproval' && part.askId === askId
        ) ?? false
      )
    }

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
      latestWorkflowId,
      recordUser,
      setThreadId,
      recordFailedSend,
      recordPaywall,
      setPaywallsResolved,
      answeringAskIds,
      setAskAnswering,
      recordAskSelection,
      submittedAskSelection,
      commitAsk,
      retireAsk,
      dismissCommittedAsks,
      startTurn,
      ingest,
      setCanvasSyncGate,
      notifyCanvasCaughtUp,
      abortActiveTurn,
      stashActiveTurn,
      resumeBackgroundTurn,
      settleBackgroundTurn,
      dropBackgroundTurns,
      reset,
      hydrate
    }
  }
)
