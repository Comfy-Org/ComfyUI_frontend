import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import type {
  AgentChatEvent,
  AgentEventTransport
} from '../../services/agent/agentEventTransport'
import { createAgentEventTransport } from '../../services/agent/agentEventTransport'
import type {
  AssistantMessage,
  MessagePart,
  TextPart,
  ToolPart
} from '../../services/agent/agentMessageParts'
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
  userAttachments: UserAttachment[] | undefined
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
     * place it survives. Keyed by thread, turn, and ref: two asset rows can
     * share a hash, and the same asset can be renamed between turns, so a
     * broader key would rewrite an earlier bubble's label. Deliberately not
     * cleared by reset(): a New chat must not cost the user their labels, and
     * a reload starts it empty, which is exactly the boundary PM-1705 draws.
     */
    const attachmentNamesByThread = new Map<
      string,
      Map<TurnId, Map<string, string>>
    >()

    function rememberAttachmentName(
      turnId: TurnId,
      ref: string,
      name: string
    ): void {
      const thread = threadId.value
      if (thread === null) return
      const turns = attachmentNamesByThread.get(thread) ?? new Map()
      const names = turns.get(turnId) ?? new Map()
      names.set(ref, name)
      turns.set(turnId, names)
      attachmentNamesByThread.set(thread, turns)
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

    function recordUserAttachments(
      turnId: TurnId,
      attachments: UserAttachment[] | undefined
    ): void {
      if (!attachments?.length) return
      userAttachments.value.set(turnId, attachments)
      for (const { name, ref } of attachments) {
        if (ref && name) rememberAttachmentName(turnId, ref, name)
      }
    }

    function recordUser(
      turnId: TurnId,
      text: string,
      attachments?: UserAttachment[],
      tags?: string[],
      workflowReferences?: WorkflowReference[]
    ): void {
      userTexts.value.set(turnId, text)
      recordUserAttachments(turnId, attachments)
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
        userAttachments: userAttachments.value.get(liveMessage.id),
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
      poppedHydratedCopy: boolean,
      removedSameIdCopy: AssistantMessage | undefined
    ): boolean {
      if (poppedHydratedCopy) return false
      return (
        adoptHydratedTurn(entry, kept, removedSameIdCopy)?.keeps === 'hydrated'
      )
    }

    /**
     * A stash holds the same attachment objects the map does, so the
     * `dropAttachmentPreviews()` inside the hydrate that ran while away
     * revoked their object URLs. Restoring one verbatim would render a dead
     * `blob:`, which `UserMessage` prefers over the `/view` URL it could have
     * fallen back to.
     */
    function withoutRevokedPreviews(
      attachments: UserAttachment[]
    ): UserAttachment[] {
      return attachments.map((attachment) =>
        attachment.previewUrl?.startsWith('blob:')
          ? { ...attachment, previewUrl: undefined }
          : attachment
      )
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
      const removedSameIdCopy = messages.value.find(
        (message) => message.id === entry.message.id
      )
      const kept = messages.value.filter((m) => m.id !== entry.message.id)
      const poppedHydratedCopy = removeHydratedCopy(entry, kept)
      if (
        hydratedCopySupersedes(
          entry,
          kept,
          poppedHydratedCopy,
          removedSameIdCopy
        )
      ) {
        entry.transport.dispose()
        return
      }
      if (
        entry.userText !== undefined &&
        !userTexts.value.has(entry.message.id)
      )
        userTexts.value.set(entry.message.id, entry.userText)
      if (
        entry.userAttachments !== undefined &&
        !userAttachments.value.has(entry.message.id)
      )
        userAttachments.value.set(
          entry.message.id,
          withoutRevokedPreviews(entry.userAttachments)
        )
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
     * The row wins, but the service wrote it and never saw the parts only a
     * live transport produces. Tab links, and any tool call the row has not
     * caught up on, ride onto it. Thinking is left behind on purpose: it is
     * broadcast-only and never persisted, so a plain reload of this thread
     * would not show it either.
     *
     * A carried tool call that is still `streaming` is copied, not aliased,
     * and forced terminal: there
     * is no transport left to settle it, and left `streaming` it would spin
     * forever on a message nothing can finish. Its OUTCOME is kept, though.
     * Streaming does not mean unfinished here -- PM-1575's canvas gate holds
     * a succeeded canvas-mutating call at `streaming` with `ok` already true
     * while it waits for the follower to catch up, and calling that a failure
     * would put a red cross on a call that worked. Only a call that truly
     * never resolved has no `ok`, and that one reads as failed, matching
     * `toolCallOk` on a restored in-progress row.
     *
     * Inserted before the row's trailing run of reply text and approval card
     * rather than appended, so a tab link the agent
     * announced while working does not render underneath the answer it
     * preceded.
     */
    function adoptLiveOnlyParts(
      hydrated: AssistantMessage,
      live: AssistantMessage
    ): void {
      const recordedCallIds = new Set(
        hydrated.parts.flatMap((part) =>
          part.type === 'tool' ? [part.callId] : []
        )
      )
      const carried = live.parts.flatMap<MessagePart>((part) => {
        if (part.type === 'tabLink') return [part]
        if (part.type !== 'tool' || recordedCallIds.has(part.callId)) return []
        return [
          part.state === 'streaming'
            ? { ...part, state: 'done' as const, ok: part.ok ?? false }
            : part
        ]
      })
      if (carried.length === 0) return
      hydrated.parts = spliceBeforeTrailingReply(hydrated.parts, carried)
    }

    /**
     * Before the run of reply text and approval card a message ends on, so a
     * call the agent made while working does not render underneath the answer
     * it preceded.
     */
    function spliceBeforeTrailingReply(
      parts: MessagePart[],
      carried: MessagePart[]
    ): MessagePart[] {
      const insertAt =
        parts.findLastIndex(
          (part) => part.type !== 'text' && part.type !== 'runApproval'
        ) + 1
      return [...parts.slice(0, insertAt), ...carried, ...parts.slice(insertAt)]
    }

    function replyText(
      message: AssistantMessage,
      draft: TextPart | null
    ): string {
      return message.parts
        .filter((part) => part.type === 'text')
        .filter((part) => part !== draft)
        .map((part) => part.text)
        .join('')
    }

    /**
     * The live message survives, so the row contributes only what the
     * transport never delivered.
     *
     * `transport` is the one still bound to `live`, or undefined when the
     * caller is about to dispose it. A surviving one has to be told about
     * every call adopted off the row, or that call's next frame arrives as a
     * stranger and pushes a second copy beside the first.
     */
    function adoptHydratedOnlyParts(
      live: AssistantMessage,
      hydrated: AssistantMessage,
      transport: AgentEventTransport | undefined
    ): void {
      adoptHydratedTools(live, hydrated, transport)
      adoptFresherHydratedText(live, hydrated, transport)
      adoptPendingAsks(hydrated, live)
    }

    /**
     * A row and the transport can hold the same call at different stages.
     * Whichever watched it finish wins, and the live copy wins a tie -- it
     * carries the duration the transport measured. A live copy is updated in
     * place rather than replaced, so the transport's own handle on it stays
     * good.
     *
     * A call adopted off the row is settled unconditionally: history returns
     * terminal rows only, and nothing would finish one that did arrive
     * unresolved, since `settle()` closes text and thinking and leaves tool
     * parts alone.
     */
    function adoptHydratedTools(
      live: AssistantMessage,
      hydrated: AssistantMessage,
      transport: AgentEventTransport | undefined
    ): void {
      const liveTools = new Map(
        live.parts.flatMap((part) =>
          part.type === 'tool' ? [[part.callId, part] as const] : []
        )
      )
      const adopted: ToolPart[] = []
      for (const part of hydrated.parts) {
        if (part.type !== 'tool') continue
        const alreadyLive = liveTools.get(part.callId)
        if (alreadyLive === undefined) {
          const copy = settledCopy(part)
          adopted.push(copy)
          transport?.adoptToolPart(copy)
        } else if (part.state === 'done' && !holdsOwnOutcome(alreadyLive)) {
          settleFromRow(alreadyLive, part)
        }
      }
      if (adopted.length === 0) return
      live.parts = spliceBeforeTrailingReply(live.parts, adopted)
    }

    /**
     * Two ways the live copy is already the better record of this call, and
     * the row must not overwrite it.
     *
     * A `done` state means the transport watched the call end itself, and it
     * carries the duration it measured, which the row does not.
     *
     * PM-1575: an `ok` already set while the state is still `streaming` is
     * the canvas gate holding a call that DID succeed until its edit shows up
     * on the graph -- not a call whose end the transport missed. Settling
     * that one from the row is the premature success glyph the gate exists to
     * prevent, and would strand its entry in the transport's pending map.
     */
    function holdsOwnOutcome(live: ToolPart): boolean {
      return live.state === 'done' || live.ok !== undefined
    }

    function settledCopy(row: ToolPart): ToolPart {
      return row.state === 'streaming'
        ? { ...row, state: 'done', ok: row.ok ?? false }
        : { ...row }
    }

    function settleFromRow(live: ToolPart, row: ToolPart): void {
      live.state = 'done'
      live.ok = row.ok ?? false
      if (row.durationMs !== undefined) live.durationMs = row.durationMs
    }

    /**
     * Reply the service persisted but the transport never delivered -- a
     * frame that failed validation on the way in, or one that landed while
     * the stash was away. Only text that strictly extends what the live copy
     * holds rides across, and only the tail of it: handing the whole row
     * across would duplicate the part already on screen. Divergent text
     * means the transport is telling a different story, and it is the one
     * still connected.
     */
    function adoptFresherHydratedText(
      live: AssistantMessage,
      hydrated: AssistantMessage,
      transport: AgentEventTransport | undefined
    ): void {
      const liveText = replyText(live, transport?.openDraft() ?? null)
      const hydratedText = replyText(hydrated, null)
      if (hydratedText === liveText || !hydratedText.startsWith(liveText))
        return
      const missing = hydratedText.slice(liveText.length)
      if (transport !== undefined) {
        transport.appendReplyText(missing)
        return
      }
      live.parts = [
        ...live.parts,
        { type: 'text', text: missing, state: 'done' }
      ]
    }

    /**
     * The row wins the turn, but a terminal row can still hold less reply than
     * the transport actually delivered -- an interrupted or errored turn is
     * written when the service gives up, not when the last delta landed. Only
     * text that strictly extends the row rides across: divergent text means
     * the row is telling a different story (stop copy, an error message) and
     * the row is authoritative for that.
     *
     * Copied parts are forced to `done`. The caller is the branch that keeps
     * the row and disposes the live transport, so a part left `streaming`
     * would spin with nothing able to settle it.
     */
    function adoptFresherLiveText(
      hydrated: AssistantMessage,
      live: AssistantMessage,
      draft: TextPart | null
    ): void {
      const hydratedText = replyText(hydrated, null)
      const liveText = replyText(live, draft)
      if (
        liveText === '' ||
        liveText === hydratedText ||
        !liveText.startsWith(hydratedText)
      )
        return
      const textParts = live.parts
        .filter((part) => part.type === 'text')
        .filter((part) => part !== draft)
      const insertAt = hydrated.parts.findIndex((part) => part.type === 'text')
      hydrated.parts = hydrated.parts.filter((part) => part.type !== 'text')
      hydrated.parts.splice(
        insertAt < 0 ? hydrated.parts.length : insertAt,
        0,
        ...textParts.map((part) => ({ ...part, state: 'done' as const }))
      )
    }

    /**
     * `index` is -1 for a copy resolved off `removedSameIdCopy`: that one was
     * filtered out of `kept` before this ran, so there is no slot to splice.
     */
    function locateHydratedCopy(
      hydratedTurnId: TurnId,
      kept: AssistantMessage[],
      removedSameIdCopy: AssistantMessage | undefined
    ): { hydrated: AssistantMessage; index: number } | undefined {
      const index = kept.findIndex((message) => message.id === hydratedTurnId)
      if (index >= 0) return { hydrated: kept[index], index }
      if (removedSameIdCopy?.id === hydratedTurnId)
        return { hydrated: removedSameIdCopy, index: -1 }
      return undefined
    }

    function adoptHydratedTurn(
      entry: BackgroundTurn,
      kept: AssistantMessage[],
      removedSameIdCopy: AssistantMessage | undefined
    ): { keeps: 'live' | 'hydrated'; turnId: TurnId } | undefined {
      const hydratedTurnId = hydratedTurnIdsByRowId.get(entry.messageId)
      if (hydratedTurnId === undefined) return undefined
      const located = locateHydratedCopy(
        hydratedTurnId,
        kept,
        removedSameIdCopy
      )
      if (!located || located.hydrated === entry.message) return undefined
      const { hydrated, index } = located
      if (!hydratedStreamingTurnIds.has(hydratedTurnId)) {
        adoptLiveOnlyParts(hydrated, entry.message)
        adoptFresherLiveText(
          hydrated,
          entry.message,
          entry.transport.openDraft()
        )
        return { keeps: 'hydrated', turnId: hydratedTurnId }
      }
      if (index >= 0) kept.splice(index, 1)
      // A settled stash keeps its parts but loses its transport right after
      // this, in the `entry.settled` branch of resumeBackgroundTurn.
      adoptHydratedOnlyParts(
        entry.message,
        hydrated,
        entry.settled ? undefined : entry.transport
      )
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
      const namesByTurn =
        threadId.value === null
          ? undefined
          : attachmentNamesByThread.get(threadId.value)
      userAttachments.value = new Map(
        [...transcript.userAttachments].map(([turnId, attachments]) => [
          turnId,
          attachments.map((attachment) => {
            const liveTurnNames =
              namesByTurn?.get(turnId) ??
              [...(namesByTurn ?? [])].find(
                ([liveTurnId]) =>
                  hydratedTurnIdsByRowId.get(liveTurnId) === turnId
              )?.[1]
            const name = attachment.ref
              ? liveTurnNames?.get(attachment.ref)
              : undefined
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
