import { defineStore } from 'pinia'
import type { Ref } from 'vue'
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
    const resolvedPaywallIds = ref(new Set<TurnId>())
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
    /**
     * The name the user attached, keyed by the storage ref the turn was posted
     * under. A persisted row names every file by that ref and nothing on the
     * request carries the name (PM-1705), so within a session this is the only
     * place it survives. Keyed by thread as well as ref: two asset rows can
     * share a hash, so an unscoped ref could hand one thread a name the user
     * only ever typed in another. Deliberately not cleared by reset(): a New
     * chat must not cost the user their labels, and a reload starts it empty,
     * which is exactly the boundary PM-1705 draws.
     */
    const attachmentNamesByThread = new Map<string, Map<string, string>>()

    function rememberAttachmentName(ref: string, name: string): void {
      const thread = threadId.value
      if (thread === null) return
      const names = attachmentNamesByThread.get(thread) ?? new Map()
      names.set(ref, name)
      attachmentNamesByThread.set(thread, names)
    }
    const settledActiveTransports = new Set<AgentEventTransport>()
    const backgroundTurns = new Map<string, BackgroundTurn>()
    let hydratedTurnIdsByRowId = new Map<string, TurnId>()
    let hydratedAssistantTurnIds = new Set<TurnId>()
    let hydratedStreamingTurnIds = new Set<TurnId>()
    const reportedPaywallImpressions = new Set<TurnId>()
    const approvalShownAtByAsk = new Map<string, number>()
    const shownApprovalIds = new Set<string>()
    const activeIndex = ref(-1)

    function recordApprovalShown(askId: string, shownAt: number): boolean {
      if (shownApprovalIds.has(askId)) return false
      shownApprovalIds.add(askId)
      approvalShownAtByAsk.set(askId, shownAt)
      return true
    }

    function approvalShownAt(askId: string): number | undefined {
      return approvalShownAtByAsk.get(askId)
    }

    function forgetApprovalTiming(askId: string): void {
      approvalShownAtByAsk.delete(askId)
    }

    function forgetApproval(askId: string): void {
      forgetApprovalTiming(askId)
      shownApprovalIds.delete(askId)
    }

    // Approval dedupe/timing belongs to one conversation: a remount of the
    // same thread keeps it (hydrate alone must not re-arm a shown card), while
    // leaving the thread drops the abandoned asks with it.
    function forgetAllApprovals(): void {
      approvalShownAtByAsk.clear()
      shownApprovalIds.clear()
    }

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
      if (attachments !== undefined && attachments.length > 0) {
        userAttachments.value.set(turnId, attachments)
        for (const { name, ref } of attachments)
          if (ref) rememberAttachmentName(ref, name)
      }
      if (tags !== undefined && tags.length > 0)
        userTags.value.set(turnId, tags)
      if (workflowReferences !== undefined && workflowReferences.length > 0)
        userWorkflowReferences.value.set(turnId, workflowReferences)
    }

    function setThreadId(id: string | null): void {
      if (id !== threadId.value) forgetAllApprovals()
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
      const resolved = new Set(resolvedPaywallIds.value)
      for (const message of messages.value) {
        if (message.parts.some((part) => part.type === 'paywall')) {
          resolved.add(message.id)
        }
      }
      resolvedPaywallIds.value = resolved
    }

    function claimPaywallImpression(turnId: TurnId): boolean {
      if (reportedPaywallImpressions.has(turnId)) return false
      reportedPaywallImpressions.add(turnId)
      return true
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

    /**
     * Both ways a resume can find that the copy already on screen IS this
     * turn: a settled stash whose row came back, and an unsettled one whose
     * row holds more of the reply than the stash does. Either way the stash's
     * transport is discarded for good, so the caller flushes what it is still
     * holding rather than leaving it unreachable until its own STALE_AFTER_MS.
     */
    function hydratedCopySupersedes(
      entry: BackgroundTurn,
      kept: AssistantMessage[],
      poppedHydratedCopy: boolean
    ): boolean {
      if (poppedHydratedCopy) return false
      if (entry.settled) return hydratedTurnIdsByRowId.has(entry.messageId)
      return adoptHydratedTurn(entry, kept)?.keeps === 'hydrated'
    }

    function activateResumedTurn(entry: BackgroundTurn, index: number): void {
      // A hydrate that landed on a mid-ask row left its own transport in the
      // active slot, and this resume supersedes it. Dispose rather than
      // overwrite, or it is orphaned until its own STALE_AFTER_MS fallback.
      if (transport && transport !== entry.transport) transport.dispose()
      activeTurnId.value = entry.messageId
      activeIndex.value = index
      transport = entry.transport
      liveMessage = entry.message
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
      if (hydratedCopySupersedes(entry, kept, poppedHydratedCopy)) {
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
        // superseded branch above, so flush anything it is still holding
        // rather than leaving it unreachable until its own STALE_AFTER_MS
        // fallback.
        entry.transport.dispose()
        return
      }
      activateResumedTurn(entry, index)
    }

    function moveTurnRecord<T>(
      record: Ref<Map<TurnId, T>>,
      from: TurnId,
      to: TurnId
    ): void {
      const value = record.value.get(from)
      if (value === undefined) return
      record.value.delete(from)
      record.value.set(to, value)
    }

    // userTags is absent on purpose: hydrate() clears it outright, so the key
    // being moved from can never hold any.
    function moveUserRecord(from: TurnId, to: TurnId): void {
      moveTurnRecord(userTexts, from, to)
      moveTurnRecord(userAttachments, from, to)
      moveTurnRecord(userWorkflowReferences, from, to)
    }

    /**
     * A run_approval the hydrated copy was carrying has no counterpart on the
     * live message: it was persisted on the row, not broadcast over the
     * transport the stash holds. Dropping the copy without it leaves the ask
     * unanswerable, so it rides across, keyed on askId like the live path.
     */
    function adoptPendingAsks(
      hydrated: AssistantMessage,
      live: AssistantMessage
    ): void {
      const presentAskIds = new Set(
        live.parts.flatMap((part) =>
          part.type === 'runApproval' ? [part.askId] : []
        )
      )
      const asks = hydrated.parts.filter(
        (part) => part.type === 'runApproval' && !presentAskIds.has(part.askId)
      )
      if (asks.length > 0) live.parts = [...live.parts, ...asks]
    }

    /**
     * A turn stashed mid-flight and hydrated while away comes back as two
     * messages: the stash under the live turn id, and the hydrated copy under
     * the server's turn_id. They are one turn -- the live id IS the assistant
     * ROW's id (services/agent/server/agent_handler.go), which is why a row id
     * resolves it -- and neither dedupe path above catches that. The stash
     * holds the live transport and the deltas that arrived while away, the
     * copy holds the user-side record hydrate() rebuilt; so the copy goes and
     * its record moves onto the live turn.
     */
    function replyTextLength(message: AssistantMessage): number {
      return message.parts.reduce(
        (total, part) => total + (part.type === 'text' ? part.text.length : 0),
        0
      )
    }

    /**
     * Whether the row can stand in for the stash. Equal counts as superseding:
     * a stash that received every delta but never the done frame holds exactly
     * what the row holds, and reinstating it would leave the turn streaming
     * with no transport left to finish it. Both dimensions have to be covered
     * -- text for the reply, part count for the tool calls the row may not
     * have caught up on -- so a stash holding anything extra still wins.
     */
    function supersedesLiveReply(
      hydrated: AssistantMessage,
      live: AssistantMessage
    ): boolean {
      if (live.parts.length === 0) return hydrated.parts.length > 0
      return (
        replyTextLength(hydrated) >= replyTextLength(live) &&
        hydrated.parts.length >= live.parts.length
      )
    }

    function adoptHydratedTurn(
      entry: BackgroundTurn,
      kept: AssistantMessage[]
    ): { keeps: 'live' | 'hydrated'; turnId: TurnId } | undefined {
      const hydratedTurnId = hydratedTurnIdsByRowId.get(entry.messageId)
      if (hydratedTurnId === undefined || hydratedTurnId === entry.message.id)
        return undefined
      const index = kept.findIndex((message) => message.id === hydratedTurnId)
      if (index < 0) return undefined
      const hydrated = kept[index]
      // The stash is the better copy only while its transport was delivering.
      // One that missed the end of its turn holds nothing, or half a reply,
      // while the row behind it holds all of it -- and losing that is worse
      // than the duplicate this dedupe exists to remove. Only for a row the
      // service calls finished: a streaming row can already carry terminal
      // tool calls while its reply is still coming, and keeping that copy
      // would strand the turn with no transport left to finish it.
      if (
        !hydratedStreamingTurnIds.has(hydratedTurnId) &&
        supersedesLiveReply(hydrated, entry.message)
      )
        return { keeps: 'hydrated', turnId: hydratedTurnId }
      kept.splice(index, 1)
      adoptPendingAsks(hydrated, entry.message)
      moveUserRecord(hydratedTurnId, entry.message.id)
      return { keeps: 'live', turnId: entry.message.id }
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
      moveUserRecord(last.id, entry.message.id)
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
      resolvedPaywallIds.value = new Set()
      dropAttachmentPreviews()
      threadId.value = null
      forgetAllApprovals()
      hydratedTurnIdsByRowId = new Map()
      hydratedAssistantTurnIds = new Set()
      hydratedStreamingTurnIds = new Set()
      reportedPaywallImpressions.clear()
      clearActive()
    }

    function hydrate(history: AgentMessages): void {
      disposeActiveAndSettledTransports()
      clearActive()
      const transcript = normalizeAgentTranscript(history)
      messages.value = transcript.messages
      resolvedPaywallIds.value = new Set()
      userTexts.value = transcript.userTexts
      userTags.value = new Map()
      userWorkflowReferences.value = transcript.userWorkflowReferences
      latestWorkflowId.value = transcript.latestWorkflowId
      hydratedTurnIdsByRowId = transcript.turnIdsByRowId
      hydratedAssistantTurnIds = transcript.assistantTurnIds
      hydratedStreamingTurnIds = transcript.streamingTurnIds
      dropAttachmentPreviews()
      const names =
        threadId.value === null
          ? undefined
          : attachmentNamesByThread.get(threadId.value)
      userAttachments.value = new Map(
        [...transcript.userAttachments].map(([turnId, attachments]) => [
          turnId,
          attachments.map((attachment) => {
            const name = attachment.ref ? names?.get(attachment.ref) : undefined
            return name === undefined ? attachment : { ...attachment, name }
          })
        ])
      )
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
      messages.value.flatMap((recordedMessage) => {
        const isPaywallResolved = resolvedPaywallIds.value.has(
          recordedMessage.id
        )
        const message = isPaywallResolved
          ? {
              ...recordedMessage,
              parts: recordedMessage.parts.filter(
                (part) => part.type !== 'paywall'
              )
            }
          : recordedMessage
        const text = userTexts.value.get(message.id)
        const assistantEntries =
          isPaywallResolved && message.parts.length === 0 ? [] : [message]
        if (text === undefined) return assistantEntries
        return [
          {
            id: message.id,
            role: 'user',
            text,
            attachments: userAttachments.value.get(message.id),
            tags: userTags.value.get(message.id),
            workflowReferences: userWorkflowReferences.value.get(message.id)
          },
          ...assistantEntries
        ]
      })
    )

    const activeMessage = computed(() =>
      activeIndex.value >= 0 ? messages.value[activeIndex.value] : null
    )
    const activeMessageId = computed(() => activeMessage.value?.id ?? null)
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
      activeMessageId,
      threadId,
      isStreaming,
      status,
      latestWorkflowId,
      recordApprovalShown,
      approvalShownAt,
      forgetApprovalTiming,
      forgetApproval,
      recordUser,
      setThreadId,
      recordFailedSend,
      recordPaywall,
      resolvePaywalls,
      claimPaywallImpression,
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
