import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import { toTurnId } from '../../schemas/agentApiSchema'
import type {
  AgentChatEvent,
  AgentEventTransport
} from '../../services/agent/agentEventTransport'
import { createAgentEventTransport } from '../../services/agent/agentEventTransport'
import type { AssistantMessage } from '../../services/agent/agentMessageParts'
import { createAssistantMessage } from '../../services/agent/agentMessageParts'
import {
  normalizeAgentTranscript,
  settleLiveMessage
} from '../../services/agent/agentTranscript'
import { createUndeliverableAskReporter } from '../../services/agent/undeliverableAskReporter'
import type {
  NormalizedAgentTranscript,
  UserAttachment
} from '../../services/agent/agentTranscript'
import type { WorkflowReference } from '../../types/workflowReference'

export type { UserAttachment }

type ConversationStatus = 'idle' | 'thinking' | 'streaming'

type AskSelection = 'run' | 'cancel'

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
  threadId: string
  messageId: TurnId
  message: AssistantMessage
  transport: AgentEventTransport
  userText: string | undefined
  settled: boolean
}

interface ActiveTurnSlot {
  origin: 'local' | 'snapshot' | 'background'
  turnId: TurnId
  index: number
  threadId: string | null
  message: AssistantMessage
  transport: AgentEventTransport
}

/**
 * PM-1658: how long an accepted answer waits for its `agent_ask_resolved`
 * frame before the card is retired anyway. Generous, because the frame is the
 * normal release and arrives in milliseconds; it exists only so a lost frame
 * cannot leave the card disabled for the rest of the session.
 */
const ASK_RESOLUTION_GRACE_MS = 15_000

export interface LiveTurn {
  threadId: string
  messageId: TurnId
}

interface AnchoredLocalPart {
  part: AssistantMessage['parts'][number]
  toolCount: number
  textOffset: number
}

function anchorLocalParts(
  parts: AssistantMessage['parts']
): AnchoredLocalPart[] {
  const localParts: AnchoredLocalPart[] = []
  let toolCount = 0
  let textOffset = 0
  for (const part of parts) {
    if (part.type === 'text') {
      textOffset += part.text.length
      continue
    }
    if (part.type === 'tool') {
      toolCount += 1
      textOffset = 0
      continue
    }
    if (part.type === 'runApproval') continue
    localParts.push({ part, toolCount, textOffset })
  }
  return localParts
}

function textSplitAt(
  part: Extract<AssistantMessage['parts'][number], { type: 'text' }>,
  toolCount: number,
  textOffset: number,
  anchor: AnchoredLocalPart
): number | undefined {
  if (toolCount !== anchor.toolCount) return undefined
  const splitAt = anchor.textOffset - textOffset
  return splitAt >= 0 && splitAt <= part.text.length ? splitAt : undefined
}

function replaceTextWithLocalPart(
  parts: AssistantMessage['parts'],
  index: number,
  part: Extract<AssistantMessage['parts'][number], { type: 'text' }>,
  localPart: AssistantMessage['parts'][number],
  splitAt: number
): void {
  const before = { ...part, text: part.text.slice(0, splitAt) }
  const after = { ...part, text: part.text.slice(splitAt) }
  parts.splice(
    index,
    1,
    ...(before.text ? [before] : []),
    localPart,
    ...(after.text ? [after] : [])
  )
}

function insertAnchoredLocalPart(
  parts: AssistantMessage['parts'],
  anchor: AnchoredLocalPart
): void {
  let toolCount = 0
  let textOffset = 0
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    if (part.type === 'tool') {
      const atAnchor =
        toolCount === anchor.toolCount && textOffset === anchor.textOffset
      if (atAnchor) {
        parts.splice(index, 0, anchor.part)
        return
      }
      toolCount += 1
      textOffset = 0
      continue
    }
    if (part.type !== 'text') continue
    const splitAt = textSplitAt(part, toolCount, textOffset, anchor)
    if (splitAt === undefined) {
      textOffset += part.text.length
      continue
    }
    replaceTextWithLocalPart(parts, index, part, anchor.part, splitAt)
    return
  }
  parts.push(anchor.part)
}

function interleaveLocalParts(
  persistedParts: AssistantMessage['parts'],
  localParts: AnchoredLocalPart[]
): AssistantMessage['parts'] {
  const mergedParts = [...persistedParts]
  let groupStart = 0
  while (groupStart < localParts.length) {
    const first = localParts[groupStart]
    let groupEnd = groupStart + 1
    while (
      groupEnd < localParts.length &&
      localParts[groupEnd].toolCount === first.toolCount &&
      localParts[groupEnd].textOffset === first.textOffset
    )
      groupEnd += 1
    for (let index = groupEnd - 1; index >= groupStart; index -= 1)
      insertAnchoredLocalPart(mergedParts, localParts[index])
    groupStart = groupEnd
  }
  return mergedParts
}

function finishWithPersistedParts(
  message: AssistantMessage,
  persistedParts: AssistantMessage['parts'] | undefined
): void {
  if (persistedParts === undefined) {
    message.parts = message.parts
      .filter((part) => part.type !== 'runApproval')
      .map((part) =>
        'state' in part && part.state === 'streaming'
          ? { ...part, state: 'done' }
          : part
      )
    return
  }
  message.parts = interleaveLocalParts(
    persistedParts,
    anchorLocalParts(message.parts)
  )
}

const MAX_DEPARTED_TURNS = 32

export const useAgentConversationStore = defineStore(
  'agentConversation',
  () => {
    const messages = ref<AssistantMessage[]>([])
    const threadId = ref<string | null>(null)
    const userTexts = ref(new Map<TurnId, string>())
    const userAttachments = ref(new Map<TurnId, UserAttachment[]>())
    const userTags = ref(new Map<TurnId, string[]>())
    const userWorkflowReferences = ref(new Map<TurnId, WorkflowReference[]>())
    const attachmentNamesByThread = new Map<string, Map<string, string>>()
    const latestWorkflowId = ref<string>()
    const resolvedPaywallIds = ref(new Set<TurnId>())
    const activeSlot = shallowRef<ActiveTurnSlot | null>(null)
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
    let hydratedTurnIds = new Map<string, TurnId>()
    let hydratedAssistantTurnIds = new Set<TurnId>()
    const demotedSnapshotByStash = new Map<TurnId, TurnId>()
    const restoredBackgroundMessageIds = new Set<TurnId>()
    const reportedPaywallImpressions = new Set<TurnId>()
    const approvalShownAtByAsk = new Map<string, number>()
    const shownApprovalIds = new Set<string>()
    const undeliverableAskReporter = createUndeliverableAskReporter()
    const departedTurns = new Map<string, 'no-live-turn' | 'settled-turn'>()
    const activeTurnId = computed(() => activeSlot.value?.turnId ?? null)

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
      // PM-1575: looked up by id, not the active slot's index. A turn's own
      // transport keeps emitting after settle -- notifyCanvasCaughtUp() can
      // still land on it while a tool-call part is held pending canvas
      // catch-up (see settledActiveTransports below) -- and by then
      // clearActive() has already released the active slot, even though
      // the settled message is still sitting in `messages` at its own slot.
      const index = messages.value.findIndex((m) => m.id === message.id)
      if (index >= 0) messages.value[index] = message
    }

    function rememberAttachmentNames(attachments: UserAttachment[]): void {
      const currentThreadId = threadId.value
      if (currentThreadId === null) return
      const names = attachmentNamesByThread.get(currentThreadId) ?? new Map()
      for (const attachment of attachments) {
        if (attachment.ref) names.set(attachment.ref, attachment.name)
      }
      attachmentNamesByThread.set(currentThreadId, names)
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
        rememberAttachmentNames(attachments)
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

    /**
     * PM-1658: retires a run-approval card that must never be offered again,
     * the way an `agent_ask_resolved` frame would. `ingest` cannot serve this:
     * it routes only to the active turn, and the cases this exists for are
     * exactly the ones where that turn is gone. Every holder of the message
     * has to be told, or whichever one is asked to republish next puts the
     * card back.
     */
    function retireAsk(askId: string, owner?: string): void {
      const key = threadKey(owner)
      const withoutAsk = (parts: AssistantMessage['parts']) =>
        parts.filter(
          (part) => part.type !== 'runApproval' || part.askId !== askId
        )
      // Everything below the stash belongs to whichever thread is on screen,
      // so it is only the right target when this ask belongs to that thread
      // too. An answer that settles after the user moved on must reach back to
      // the thread it was given on, not edit the one now in front of them.
      if (key === threadKey()) {
        messages.value = messages.value.map((message) => {
          const parts = withoutAsk(message.parts)
          return parts.length === message.parts.length
            ? message
            : { ...message, parts }
        })
        activeSlot.value?.transport.dropAskPart(askId)
        for (const settledTransport of settledActiveTransports)
          settledTransport.dropAskPart(askId)
      }
      // The stashed turn IS that reach-back: a thread the user has left keeps
      // its message here, and resumeBackgroundTurn would put the card back on
      // screen if this did not strip it.
      for (const entry of backgroundTurns.values())
        if (entry.threadId === key) entry.transport.dropAskPart(askId)
      retiredAsksFor(key).add(askId)
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

    const threadKey = (owner?: string) => owner ?? threadId.value ?? ''

    function retiredAsksFor(owner?: string): Set<string> {
      const key = threadKey(owner)
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

    const answeringAskIds = ref<ReadonlySet<string>>(new Set())

    function setAskAnswering(askId: string, answering: boolean): void {
      const next = new Set(answeringAskIds.value)
      if (answering) next.add(askId)
      else next.delete(askId)
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
    function commitAsk(askId: string, owner?: string): void {
      const key = threadKey(owner)
      if (!activeTurnOwnsAsk(askId) || key !== threadKey()) {
        retireAsk(askId, key)
        return
      }
      clearAskResolutionWatchdog(askId)
      askResolutionWatchdogs.set(
        askId,
        setTimeout(() => retireAsk(askId, key), ASK_RESOLUTION_GRACE_MS)
      )
    }

    function startTurn(turnId: TurnId): void {
      if (activeSlot.value) abortActiveTurn()
      const message = createAssistantMessage(turnId)
      activeSlot.value = {
        origin: 'local',
        turnId,
        index: messages.value.push(message) - 1,
        threadId: threadId.value,
        message,
        transport: createAgentEventTransport(
          message,
          replaceActive,
          () => canvasSyncGate(),
          () => canvasSyncOutcomeCount(),
          reportUndeliverableAskData
        )
      }
    }

    function ingest(event: AgentChatEvent): void {
      const activeTransport = activeSlot.value?.transport
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
      // Unreachable for `agent_ask`: the schema makes `thread_id` required on
      // every event except `agent_active_tab`, handled above.
      if (eventThreadId === undefined) return
      ingestBackgroundTurnEvent(event, eventThreadId)
    }

    /**
     * A dropped `agent_ask` is the one lost frame with no user-visible symptom:
     * the server parks the turn waiting for an answer, the panel keeps showing
     * whatever it last had, and nothing errors. The only report we have of this
     * class reached us through a feedback form that happened to include a
     * session id, so every `return` that can swallow an ask says so here.
     *
     * Deliberately not a `pushError`: the user cannot act on it, and a notice
     * would replace a silent stall with a stall plus a scary message. This is
     * for the dashboard.
     */
    function reportUndeliverableAsk(
      event: AgentChatEvent,
      reason: 'no-live-turn' | 'settled-turn'
    ): void {
      if (event.type !== 'agent_ask') return
      reportUndeliverableAskData(event.data, reason)
    }

    function reportUndeliverableAskData(
      data: Extract<AgentChatEvent, { type: 'agent_ask' }>['data'],
      reason:
        | 'no-live-turn'
        | 'settled-turn'
        | 'unknown-kind'
        | 'unrendered-kind'
    ): void {
      undeliverableAskReporter.report(data, reason, {
        hasActiveTurn: activeTurnId.value !== null,
        backgroundTurnCount: backgroundTurns.size,
        activeThreadId: threadId.value,
        activeTurnId: activeTurnId.value
      })
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
      rememberDepartedActiveTurn('settled-turn')
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
        activeSlot.value?.transport.ingest(event)
      else soleLiveBackgroundTurn(eventThreadId)?.transport.ingest(event)
    }

    function ingestBackgroundTurnEvent(
      event: AgentChatEvent,
      eventThreadId: string
    ): void {
      const eventMessageId = event.data.message_id
      const entry =
        eventMessageId === undefined
          ? undefined
          : backgroundTurns.get(eventMessageId)
      if (!entry || entry.threadId !== eventThreadId) {
        const reason =
          eventMessageId === undefined
            ? undefined
            : departedTurns.get(departedTurnKey(eventThreadId, eventMessageId))
        if (reason) reportUndeliverableAsk(event, reason)
        return
      }
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
      activeSlot.value?.transport.notifyCanvasCaughtUp()
      for (const settledTransport of settledActiveTransports) {
        settledTransport.notifyCanvasCaughtUp()
        if (!settledTransport.hasPendingCanvasSync())
          settledActiveTransports.delete(settledTransport)
      }
      for (const entry of backgroundTurns.values())
        entry.transport.notifyCanvasCaughtUp()
    }

    function abortActiveTurn(): void {
      const slot = activeSlot.value
      if (!slot) return
      rememberDepartedActiveTurn('no-live-turn')
      slot.transport.settle()
      // Not `settledActiveTransports`: an abort is not a natural completion
      // whose held parts might still catch up, so flush them to `done` and
      // cancel their timers now rather than leaving them reachable only by
      // their own STALE_AFTER_MS fallback (or, worse, orphaned).
      slot.transport.dispose()
      clearActive()
    }

    function stashActiveTurn(): void {
      const slot = activeSlot.value
      if (!slot) return
      if (slot.threadId === null) {
        abortActiveTurn()
        return
      }
      backgroundTurns.set(slot.turnId, {
        threadId: slot.threadId,
        messageId: slot.turnId,
        message: slot.message,
        transport: slot.transport,
        userText: userTexts.value.get(slot.message.id),
        settled: false
      })
      clearActive()
    }

    function resumeBackgroundTurn(): void {
      const resumable = backgroundTurnToResume()
      if (!resumable) return
      const { entry, resumedThreadId } = resumable
      backgroundTurns.delete(entry.messageId)
      replaceSnapshotWithBackgroundTurn(entry, resumedThreadId)
    }

    function backgroundTurnToResume():
      | { entry: BackgroundTurn; resumedThreadId: string }
      | undefined {
      const resumedThreadId = threadId.value
      if (resumedThreadId === null) return undefined
      const entry = latestBackgroundTurn(resumedThreadId)
      if (!entry) return undefined
      // A live turn from the thread we are leaving must become a background
      // turn before the selected thread resumes. A newer turn on the selected
      // thread, however, already owns the slot; replacing it would orphan its
      // transport, so leave the older stash routable in the background.
      const slot = activeSlot.value
      if (slot !== null && slot.origin !== 'snapshot') {
        if (slot.threadId === resumedThreadId) return undefined
        stashActiveTurn()
      }
      return { entry, resumedThreadId }
    }

    function replaceSnapshotWithBackgroundTurn(
      entry: BackgroundTurn,
      resumedThreadId: string
    ): void {
      // A snapshot the stash could not be matched to installed its own live
      // row, and this stash is about to take the slot. Ownership matching
      // cannot close that gap alone: a multi-row turn's acknowledgement row
      // id, its newest persisted row id, and its `turn_id` are three
      // different values, and `pending` carries the last two while the stash
      // carries the first. Settling what we replace is what makes the outcome
      // independent of which of them coincide -- left alone, that row's
      // transport is unreachable and it streams for good.
      const unmatchedSnapshotId = abortUnmatchedSnapshot()
      // The stash keys a turn by its message_id while hydrate() re-keys the same
      // turn by the server's turn_id; row.id bridges the two. Matching turns by
      // identity, not by shared user text, is what stops a repeated prompt from
      // colliding with an unrelated turn.
      const persistedMessageId = hydratedTurnIds.get(entry.messageId)
      const kept = messages.value.filter(
        (message) =>
          message.id !== entry.message.id && message.id !== unmatchedSnapshotId
      )
      // Called before the branch, not inside it: it pops the duplicate row and
      // its user text whether or not this entry turns out to be settled.
      const replacedIndex = removeHydratedCopy(entry, kept)
      if (retirePersistedBackgroundTurn(entry, replacedIndex !== undefined))
        return
      if (persistedMessageId !== undefined)
        entry.message.id = persistedMessageId
      restoreBackgroundUserText(entry)
      const index = replacedIndex ?? kept.length
      kept.splice(index, 0, entry.message)
      restoredBackgroundMessageIds.add(entry.messageId)
      messages.value = kept
      if (entry.settled) {
        retireBackgroundTurn(entry)
        return
      }
      claimSlotForBackgroundTurn(entry, index, resumedThreadId)
    }

    function abortUnmatchedSnapshot(): string | undefined {
      const slot = activeSlot.value
      if (slot?.origin !== 'snapshot') return undefined
      const snapshotId = slot.message.id
      abortActiveTurn()
      userTexts.value.delete(snapshotId)
      return snapshotId
    }

    function claimSlotForBackgroundTurn(
      entry: BackgroundTurn,
      index: number,
      resumedThreadId: string
    ): void {
      activeSlot.value = {
        origin: 'background',
        turnId: entry.messageId,
        index,
        threadId: resumedThreadId,
        message: entry.message,
        transport: entry.transport
      }
    }

    /**
     * Whether the hydrated transcript already shows this settled turn, so the
     * entry has nothing left to contribute but the transport it is about to
     * hand over.
     */
    function persistedCopyOutlivesEntry(
      entry: BackgroundTurn,
      poppedHydratedCopy: boolean
    ): boolean {
      return (
        entry.settled &&
        !poppedHydratedCopy &&
        hydratedMessageIds.has(entry.messageId)
      )
    }

    function retirePersistedBackgroundTurn(
      entry: BackgroundTurn,
      poppedHydratedCopy: boolean
    ): boolean {
      if (!persistedCopyOutlivesEntry(entry, poppedHydratedCopy)) return false
      retireBackgroundTurn(entry)
      return true
    }

    /**
     * PM-1575: flush what the discarded transport still holds rather than
     * leaving it reachable only by its own STALE_AFTER_MS fallback.
     */
    function retireBackgroundTurn(entry: BackgroundTurn): void {
      rememberDepartedTurn(entry.threadId, entry.messageId, 'settled-turn')
      entry.transport.dispose()
    }

    function latestBackgroundTurn(
      backgroundThreadId: string
    ): BackgroundTurn | undefined {
      let latest: BackgroundTurn | undefined
      for (const entry of backgroundTurns.values()) {
        if (entry.threadId === backgroundThreadId) latest = entry
      }
      return latest
    }

    /**
     * `agent_active_tab` is the one event whose `message_id` is optional, so an
     * unkeyed frame on a thread holding several live turns names no sender.
     * Insertion order is not that identity, and the frame is not inert on the
     * turn it lands in: `handleActiveTabEvent` closes the open text part, so
     * the next delta starts a second one, and it clears the thinking
     * indicator. A guess therefore fragments an unrelated live transcript and
     * misfiles the link. Dropping costs one tabLink on a thread off screen.
     */
    function soleLiveBackgroundTurn(
      backgroundThreadId: string
    ): BackgroundTurn | undefined {
      let sole: BackgroundTurn | undefined
      for (const entry of backgroundTurns.values()) {
        if (entry.threadId !== backgroundThreadId || entry.settled) continue
        if (sole) return undefined
        sole = entry
      }
      return sole
    }

    function restoreBackgroundUserText(entry: BackgroundTurn): void {
      if (
        entry.userText !== undefined &&
        !userTexts.value.has(entry.message.id)
      )
        userTexts.value.set(entry.message.id, entry.userText)
    }

    function removeHydratedCopy(
      entry: BackgroundTurn,
      kept: AssistantMessage[]
    ): number | undefined {
      const demotedSnapshotId = demotedSnapshotByStash.get(entry.messageId)
      demotedSnapshotByStash.delete(entry.messageId)
      if (demotedSnapshotId !== undefined) {
        const index = kept.findIndex(
          (message) => message.id === demotedSnapshotId
        )
        if (index !== -1) {
          kept.splice(index, 1)
          userTexts.value.delete(demotedSnapshotId)
          return index
        }
      }
      if (kept.length !== messages.value.length) return undefined
      const last = kept.at(-1)
      if (
        !last ||
        hydratedAssistantTurnIds.has(last.id) ||
        restoredBackgroundMessageIds.has(last.id)
      )
        return undefined
      if (
        entry.userText === undefined ||
        userTexts.value.get(last.id) !== entry.userText
      )
        return undefined
      const index = kept.length - 1
      kept.pop()
      userTexts.value.delete(last.id)
      return index
    }

    function settleBackgroundTurn(turnId: string): TurnId | null {
      const entry = backgroundTurns.get(turnId)
      if (entry) {
        rememberDepartedTurn(entry.threadId, entry.messageId, 'settled-turn')
        entry.transport.settle()
        // This turn is being dropped from the map here, unlike the
        // agent_message_done path in ingestBackgroundTurnEvent -- nothing
        // will keep it reachable afterwards, so flush its held parts now.
        entry.transport.dispose()
        backgroundTurns.delete(entry.messageId)
        return entry.messageId
      }
      return null
    }

    function dropBackgroundTurns(): void {
      for (const entry of backgroundTurns.values()) {
        rememberDepartedTurn(
          entry.threadId,
          entry.messageId,
          entry.settled ? 'settled-turn' : 'no-live-turn'
        )
        entry.transport.settle()
        entry.transport.dispose()
      }
      backgroundTurns.clear()
    }

    function liveTurns(): LiveTurn[] {
      const background = Array.from(backgroundTurns.values())
        .filter((entry) => !entry.settled)
        .map((entry) => ({
          threadId: entry.threadId,
          messageId: entry.messageId
        }))
      const slot = activeSlot.value
      if (slot === null || slot.threadId === null) return background
      return [
        { threadId: slot.threadId, messageId: slot.turnId },
        ...background
      ]
    }

    function settleTurn(
      turn: LiveTurn,
      persistedParts: AssistantMessage['parts'] | undefined
    ): void {
      const slot = activeSlot.value
      const isActive =
        slot !== null &&
        turn.threadId === slot.threadId &&
        turn.messageId === slot.turnId
      if (isActive) {
        finishWithPersistedParts(slot.message, persistedParts)
        rememberDepartedActiveTurn('settled-turn')
        slot.transport.settle()
        slot.transport.dispose()
        clearActive()
        return
      }
      const entry = backgroundTurns.get(turn.messageId)
      if (!entry || entry.messageId !== turn.messageId || entry.settled) return
      finishWithPersistedParts(entry.message, persistedParts)
      entry.transport.settle()
      entry.settled = true
    }

    function departedTurnKey(threadId: string, messageId: string): string {
      return `${threadId}\u0000${messageId}`
    }

    function rememberDepartedTurn(
      departedThreadId: string,
      messageId: TurnId,
      reason: 'no-live-turn' | 'settled-turn'
    ): void {
      const key = departedTurnKey(departedThreadId, messageId)
      departedTurns.delete(key)
      departedTurns.set(key, reason)
      if (departedTurns.size <= MAX_DEPARTED_TURNS) return
      const oldestKey = departedTurns.keys().next().value
      if (oldestKey !== undefined) departedTurns.delete(oldestKey)
    }

    function rememberDepartedActiveTurn(
      reason: 'no-live-turn' | 'settled-turn'
    ): void {
      const slot = activeSlot.value
      if (slot === null || slot.threadId === null) return
      rememberDepartedTurn(slot.threadId, slot.turnId, reason)
    }

    function clearActive(): void {
      activeSlot.value = null
    }

    // PM-1575: reset() and hydrate() both discard the active transport (if
    // any) and every settled-but-still-holding one outright, with no
    // background-turn stash to keep them reachable through. Without
    // disposing them first, an orphaned STALE_AFTER_MS timer can fire later
    // and write a stale snapshot back over transcript content hydrate() has
    // since replaced under the same turn id.
    function disposeActiveAndSettledTransports(): void {
      activeSlot.value?.transport.dispose()
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
      attachmentNamesByThread.clear()
      threadId.value = null
      forgetAllApprovals()
      hydratedMessageIds = new Set()
      hydratedTurnIds = new Map()
      hydratedAssistantTurnIds = new Set()
      demotedSnapshotByStash.clear()
      restoredBackgroundMessageIds.clear()
      reportedPaywallImpressions.clear()
      undeliverableAskReporter.reset()
      departedTurns.clear()
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
      const retired = retiredAsksFor()
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
      if (activeSlot.value) rememberDepartedActiveTurn('no-live-turn')
      disposeActiveAndSettledTransports()
      clearActive()
      const transcript = normalizeAgentTranscript(history)
      // Only the card is retired, never the turn: answering it is what lets
      // the turn RESUME, so it is still live and still needs a transport, or
      // every frame of the rest of it is dropped and the row stays "Working…"
      // with nothing able to settle it.
      dropResolvedAsks(transcript)
      messages.value = transcript.messages
      resolvedPaywallIds.value = new Set()
      userTexts.value = transcript.userTexts
      userTags.value = new Map()
      userWorkflowReferences.value = transcript.userWorkflowReferences
      latestWorkflowId.value = transcript.latestWorkflowId
      hydratedMessageIds = transcript.rowIds
      hydratedTurnIds = new Map(
        history
          .filter((row) => row.role === 'assistant')
          .map((row) => [row.id, toTurnId(row.turn_id)])
      )
      hydratedAssistantTurnIds = transcript.assistantTurnIds
      demotedSnapshotByStash.clear()
      restoredBackgroundMessageIds.clear()
      dropAttachmentPreviews()
      const rememberedNames =
        threadId.value === null
          ? undefined
          : attachmentNamesByThread.get(threadId.value)
      userAttachments.value = new Map(
        [...transcript.userAttachments].map(([turnId, attachments]) => [
          turnId,
          attachments.map((attachment) => {
            const name =
              attachment.ref && attachment.name === attachment.ref
                ? rememberedNames?.get(attachment.ref)
                : undefined
            return name === undefined ? attachment : { ...attachment, name }
          })
        ])
      )
      const pending = unstashedLiveTurn(transcript)
      if (pending) {
        activeSlot.value = {
          origin: 'snapshot',
          turnId: pending.messageId,
          index: messages.value.indexOf(pending.message),
          threadId: threadId.value,
          message: pending.message,
          transport: createAgentEventTransport(
            pending.message,
            replaceActive,
            () => canvasSyncGate(),
            () => canvasSyncOutcomeCount(),
            reportUndeliverableAskData
          )
        }
      }
    }

    /**
     * The transcript's live turn, unless a stashed background turn already
     * owns that same turn. The stash kept the turn's parts and never stopped
     * receiving frames, so letting the server's snapshot take the active slot
     * would route the rest of the stream to the wrong copy and leave
     * `resumeBackgroundTurn` restoring an entry that never saw its own
     * `agent_message_done` -- a turn stuck running for good.
     *
     * Demoted rather than merely skipped: the snapshot stays on screen when
     * its row id differs from the stash's, and a second live-looking row is
     * exactly what the caller is hydrating to get rid of. No lookup at resume
     * can pair the two, since the stash is keyed by row id and the snapshot
     * by `turn_id`; `removeHydratedCopy`'s tail branch cannot either, because
     * a snapshot's id is always in `hydratedAssistantTurnIds`. So the pairing
     * is recorded here, at the one point ownership is established, as
     * `demotedSnapshotByStash`. The resume
     * reads it to drop the snapshot and seat the stash at that same index,
     * leaving one row where a duplicate used to render until settlement.
     */
    function unstashedLiveTurn(
      transcript: NormalizedAgentTranscript
    ): NormalizedAgentTranscript['pending'] {
      const pending = transcript.pending
      if (!pending) return undefined
      const owner = [...backgroundTurns.values()].find(
        (stashed) =>
          stashed.threadId === threadId.value &&
          (stashed.messageId === pending.messageId ||
            stashed.message.id === pending.message.id)
      )
      if (!owner) return pending
      demotedSnapshotByStash.set(owner.messageId, pending.message.id)
      settleLiveMessage(pending.message)
      return undefined
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
      activeSlot.value === null ? null : messages.value[activeSlot.value.index]
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
      answeringAskIds,
      setAskAnswering,
      recordAskSelection,
      submittedAskSelection,
      commitAsk,
      retireAsk,
      startTurn,
      ingest,
      setCanvasSyncGate,
      notifyCanvasCaughtUp,
      abortActiveTurn,
      stashActiveTurn,
      resumeBackgroundTurn,
      settleBackgroundTurn,
      dropBackgroundTurns,
      liveTurns,
      settleTurn,
      reset,
      hydrate
    }
  }
)
