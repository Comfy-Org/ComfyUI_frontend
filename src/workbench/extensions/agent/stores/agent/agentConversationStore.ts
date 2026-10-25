import type { AgentAnswerRequest } from '@comfyorg/ingest-types'
import { createEventHook } from '@vueuse/core'
import { isEqual } from 'es-toolkit'
import { defineStore } from 'pinia'
import { computed, ref, shallowReactive, shallowRef } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { AgentTurnTab } from '@/stores/workflowTabActivityStore'

import type {
  AgentMessages,
  TurnId
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type {
  AgentChatEvent,
  AgentEventTransport,
  CanvasConfirmation,
  CanvasSyncEvidence
} from '@/workbench/extensions/agent/services/agent/agentEventTransport'
import { createAgentEventTransport } from '@/workbench/extensions/agent/services/agent/agentEventTransport'
import type {
  AskUserResolution,
  AssistantMessage
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import {
  askIdOf,
  createAssistantMessage,
  isOpenAskPart,
  isPendingAskPart,
  retireAskParts,
  settleResolution
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import {
  normalizeAgentTranscript,
  settleLiveMessage
} from '@/workbench/extensions/agent/services/agent/agentTranscript'
import { createUndeliverableAskReporter } from '@/workbench/extensions/agent/services/agent/undeliverableAskReporter'
import type {
  NormalizedAgentTranscript,
  UserAttachment
} from '@/workbench/extensions/agent/services/agent/agentTranscript'
import type { WorkflowReference } from '@/workbench/extensions/agent/types/workflowReference'
import type { SkillReference } from '@/workbench/extensions/agent/types/skillReference'
import { parseSkillReferenceText } from '@/workbench/extensions/agent/utils/skillReferenceText'

export type { UserAttachment }

type ConversationStatus = 'idle' | 'thinking' | 'streaming'

interface UserEntry {
  id: TurnId
  role: 'user'
  text: string
  attachments?: UserAttachment[]
  tags?: string[]
  workflowReferences?: WorkflowReference[]
  skillReference?: SkillReference
}

export type ConversationEntry = UserEntry | AssistantMessage

interface BackgroundTurn {
  threadId: string
  messageId: TurnId
  message: AssistantMessage
  transport: AgentEventTransport
  userText: string | undefined
  skillReference?: SkillReference
  settled: boolean
  tab: TurnTab
  approvalAskIds: readonly string[]
}

interface ActiveTurnSlot {
  origin: 'local' | 'snapshot' | 'background'
  turnId: TurnId
  index: number
  threadId: string | null
  message: AssistantMessage
  transport: AgentEventTransport
  tab: TurnTab
}

export type TurnTab =
  | { status: 'unknown' }
  | { status: 'none' }
  | { status: 'guessed'; workflowInstanceId: string }
  | { status: 'known'; workflowInstanceId: string }

const UNKNOWN_TAB: TurnTab = { status: 'unknown' }

function isProvisional(tab: TurnTab): boolean {
  return tab.status === 'unknown' || tab.status === 'guessed'
}

/**
 * PM-1658: how long an accepted answer waits for its `agent_ask_resolved`
 * frame before the card is retired anyway. Generous, because the frame is the
 * normal release and arrives in milliseconds; it exists only so a lost frame
 * cannot leave the card disabled for the rest of the session.
 */
const ASK_RESOLUTION_GRACE_MS = 15_000

function isLoadSkillPart(part: AssistantMessage['parts'][number]): boolean {
  return part.type === 'tool' && part.name === 'load_skill'
}

function runApprovalAskIds(message: AssistantMessage): string[] {
  return message.parts.flatMap((part) =>
    part.type === 'runApproval' ? [part.askId] : []
  )
}

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
    if (isOpenAskPart(part)) continue
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
    message.parts = message.parts.filter((part) => !isOpenAskPart(part))
    for (const part of message.parts) {
      if (!('state' in part) || part.state !== 'streaming') continue
      if (part.type === 'tool') {
        // A successful tool can still be waiting for canvas catch-up. Keep
        // that transport-owned state live; only clamp calls that never
        // received an outcome.
        if (part.ok !== undefined) continue
        part.ok = false
      }
      part.state = 'done'
    }
    return
  }
  const persistedHasThinking = persistedParts.some(
    (part) => part.type === 'thinking'
  )
  message.parts = interleaveLocalParts(
    persistedParts,
    anchorLocalParts(message.parts).filter(
      ({ part }) => !persistedHasThinking || part.type !== 'thinking'
    )
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
    const userSkillReferences = ref(new Map<TurnId, SkillReference>())
    /**
     * Skill names in the last loaded history; each load replaces it, and live
     * turns never add to it. Marks when an opened conversation needs the
     * saved-skill catalog its references are shown against.
     */
    const historySkillNames = shallowRef<readonly string[]>([])
    const attachmentNamesByThread = new Map<string, Map<string, string>>()
    const latestWorkflowId = ref<string>()
    const resolvedPaywallIds = ref(new Set<TurnId>())
    const activeSlot = shallowRef<ActiveTurnSlot | null>(null)
    let canvasSyncGate: (workflowId?: string) => CanvasConfirmation = () =>
      'none'
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
    const backgroundTurns = shallowReactive(new Map<string, BackgroundTurn>())
    let resolveTurnTab: () => TurnTab = () => UNKNOWN_TAB
    const turnCompleted = createEventHook<string>()
    const workflowStore = useWorkflowStore()
    const openTabPaths = computed(
      () =>
        new Map(
          workflowStore.openWorkflows.map((workflow) => [
            workflow.instanceId,
            workflow.path
          ])
        )
    )
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

    function setTurnTabResolver(resolve: () => TurnTab): void {
      resolveTurnTab = resolve
    }

    function openPathOf(tab: TurnTab): string | null {
      return 'workflowInstanceId' in tab
        ? (openTabPaths.value.get(tab.workflowInstanceId) ?? null)
        : null
    }

    function announceCompletion(tab: TurnTab): void {
      const path = openPathOf(tab)
      if (path !== null) void turnCompleted.trigger(path)
    }

    function updateBackgroundTurn(
      turnId: TurnId,
      change: Partial<
        Pick<BackgroundTurn, 'settled' | 'tab' | 'approvalAskIds'>
      >
    ): void {
      const entry = backgroundTurns.get(turnId)
      if (entry) backgroundTurns.set(turnId, { ...entry, ...change })
    }

    function assignTurnTab(
      matches: (
        turnId: TurnId,
        threadId: string | null,
        tab: TurnTab
      ) => boolean,
      workflowInstanceId: string
    ): void {
      const tab: TurnTab = { status: 'known', workflowInstanceId }
      const slot = activeSlot.value
      if (slot !== null && matches(slot.turnId, slot.threadId, slot.tab))
        activeSlot.value = { ...slot, tab }
      for (const entry of backgroundTurns.values())
        if (
          !entry.settled &&
          matches(entry.messageId, entry.threadId, entry.tab)
        )
          updateBackgroundTurn(entry.messageId, { tab })
    }

    function moveTurnToTab(turnId: TurnId, workflowInstanceId: string): void {
      assignTurnTab((id) => id === turnId, workflowInstanceId)
    }

    function adoptThreadTab(owner: string, workflowInstanceId: string): void {
      assignTurnTab(
        (_id, thread, tab) => thread === owner && isProvisional(tab),
        workflowInstanceId
      )
    }

    function publishMessage(turnId: TurnId, message: AssistantMessage): void {
      replaceActive(message)
      const entry = backgroundTurns.get(turnId)
      if (!entry) return
      const approvalAskIds = runApprovalAskIds(message)
      if (!isEqual(approvalAskIds, entry.approvalAskIds))
        updateBackgroundTurn(turnId, { approvalAskIds })
    }

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
      const prompt = parseSkillReferenceText(text, workflowReferences)
      userTexts.value.set(turnId, prompt.text)
      if (prompt.skillReference)
        userSkillReferences.value.set(turnId, prompt.skillReference)
      else userSkillReferences.value.delete(turnId)
      if (attachments !== undefined && attachments.length > 0) {
        userAttachments.value.set(turnId, attachments)
        rememberAttachmentNames(attachments)
      }
      if (tags !== undefined && tags.length > 0)
        userTags.value.set(turnId, tags)
      if (workflowReferences !== undefined && workflowReferences.length > 0)
        userWorkflowReferences.value.set(turnId, prompt.workflowReferences)
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
      recordUser(turnId, text)
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

    function retireAsk(
      askId: string,
      resolution: AskUserResolution,
      owner?: string
    ): void {
      const key = threadKey(owner)
      if (key === threadKey()) {
        messages.value = messages.value.map((message) => {
          const parts = retireAskParts(message.parts, askId, resolution)
          return parts === message.parts ? message : { ...message, parts }
        })
        activeSlot.value?.transport.retireAskPart(askId, resolution)
        for (const settledTransport of settledActiveTransports)
          settledTransport.retireAskPart(askId, resolution)
      }
      for (const entry of backgroundTurns.values())
        if (entry.threadId === key)
          entry.transport.retireAskPart(askId, resolution)
      const retired = retiredAsksFor(key)
      retired.set(askId, settleResolution(retired.get(askId), resolution))
      clearAskResolutionWatchdog(askId)
      submittedAskAnswers.delete(askId)
      setAskAnswering(askId, false)
    }

    const retiredAsks = new Map<string, Map<string, AskUserResolution>>()

    const threadKey = (owner?: string) => owner ?? threadId.value ?? ''

    function retiredAsksFor(owner?: string): Map<string, AskUserResolution> {
      const key = threadKey(owner)
      const retired =
        retiredAsks.get(key) ?? new Map<string, AskUserResolution>()
      retiredAsks.set(key, retired)
      return retired
    }

    const submittedAskAnswers = new Map<string, AgentAnswerRequest>()

    function recordAskAnswer(askId: string, answer: AgentAnswerRequest): void {
      submittedAskAnswers.set(askId, answer)
    }

    function takeSubmittedAskAnswer(
      askId: string
    ): AgentAnswerRequest | undefined {
      const answer = submittedAskAnswers.get(askId)
      submittedAskAnswers.delete(askId)
      return answer
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

    function commitAsk(
      askId: string,
      owner: string,
      committed: AskUserResolution
    ): void {
      if (!activeTurnOwnsAsk(askId) || owner !== threadKey()) {
        retireAsk(askId, committed, owner)
        return
      }
      clearAskResolutionWatchdog(askId)
      askResolutionWatchdogs.set(
        askId,
        setTimeout(
          () => retireAsk(askId, committed, owner),
          ASK_RESOLUTION_GRACE_MS
        )
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
          (snapshot) => publishMessage(turnId, snapshot),
          (workflowId) => canvasSyncGate(workflowId),
          () => canvasSyncOutcomeCount(),
          reportUndeliverableAskData
        ),
        tab: resolveTurnTab()
      }
    }

    function ingest(event: AgentChatEvent): void {
      if (isRetiredAskReplay(event)) return
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

    function isRetiredAskReplay(event: AgentChatEvent): boolean {
      return (
        event.type === 'agent_ask' &&
        retiredAsks
          .get(threadKey(event.data.thread_id))
          ?.has(event.data.ask_id) === true
      )
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
        const tab = activeSlot.value?.tab ?? UNKNOWN_TAB
        settleActiveTurn(activeTransport)
        announceCompletion(tab)
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
        if (entry.settled) return
        entry.transport.settle()
        updateBackgroundTurn(entry.messageId, { settled: true })
        announceCompletion(entry.tab)
        return
      }
      entry.transport.ingest(event)
    }

    function setCanvasSyncGate(
      gate: (workflowId?: string) => CanvasConfirmation,
      outcomeCount: () => number = () => 0
    ): void {
      canvasSyncGate = gate
      canvasSyncOutcomeCount = outcomeCount
    }

    function notifyCanvasCaughtUp(evidence?: CanvasSyncEvidence): void {
      activeSlot.value?.transport.notifyCanvasCaughtUp(evidence)
      for (const settledTransport of settledActiveTransports) {
        settledTransport.notifyCanvasCaughtUp(evidence)
        if (!settledTransport.hasPendingCanvasSync())
          settledActiveTransports.delete(settledTransport)
      }
      for (const entry of backgroundTurns.values())
        entry.transport.notifyCanvasCaughtUp(evidence)
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
        skillReference: userSkillReferences.value.get(slot.message.id),
        settled: false,
        tab: slot.tab,
        approvalAskIds: runApprovalAskIds(slot.message)
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
        transport: entry.transport,
        tab: entry.tab
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
      ) {
        userTexts.value.set(entry.message.id, entry.userText)
        if (entry.skillReference)
          userSkillReferences.value.set(entry.message.id, entry.skillReference)
      }
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

    function liveTurnSkillState(
      turn: LiveTurn
    ): Pick<BackgroundTurn, 'message' | 'skillReference'> | undefined {
      const slot = activeSlot.value
      if (slot?.threadId === turn.threadId && slot.turnId === turn.messageId)
        return {
          message: slot.message,
          skillReference: userSkillReferences.value.get(slot.message.id)
        }
      const entry = backgroundTurns.get(turn.messageId)
      return entry?.threadId === turn.threadId && !entry.settled
        ? entry
        : undefined
    }

    function turnUsesSkill(turn: LiveTurn): boolean {
      const live = liveTurnSkillState(turn)
      return (
        live !== undefined &&
        (live.skillReference !== undefined ||
          live.message.parts.some(isLoadSkillPart))
      )
    }

    function settleTurn(
      turn: LiveTurn,
      persistedParts: AssistantMessage['parts'] | undefined,
      ending: 'completed' | 'failed' = 'completed'
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
        if (ending === 'completed') announceCompletion(slot.tab)
        return
      }
      const entry = backgroundTurns.get(turn.messageId)
      if (!entry || entry.messageId !== turn.messageId || entry.settled) return
      finishWithPersistedParts(entry.message, persistedParts)
      entry.transport.settle()
      updateBackgroundTurn(entry.messageId, { settled: true })
      if (ending === 'completed') announceCompletion(entry.tab)
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
      userSkillReferences.value = new Map()
      historySkillNames.value = []
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

    function reapplyRetiredAsks(
      transcript: ReturnType<typeof normalizeAgentTranscript>
    ): void {
      const retired = retiredAsksFor()
      if (retired.size === 0) return
      const named = new Set(
        transcript.messages.flatMap((message) =>
          message.parts.flatMap((part) => askIdOf(part) ?? [])
        )
      )
      for (const askId of retired.keys())
        if (!named.has(askId)) retired.delete(askId)
      for (const message of transcript.messages)
        for (const [askId, resolution] of retired)
          message.parts = retireAskParts(message.parts, askId, resolution)
    }

    function hydrate(history: AgentMessages): void {
      const replacedSlot = activeSlot.value
      if (replacedSlot) rememberDepartedActiveTurn('no-live-turn')
      disposeActiveAndSettledTransports()
      clearActive()
      const transcript = normalizeAgentTranscript(history)
      reapplyRetiredAsks(transcript)
      messages.value = transcript.messages
      resolvedPaywallIds.value = new Set()
      userTexts.value = transcript.userTexts
      userTags.value = new Map()
      userWorkflowReferences.value = transcript.userWorkflowReferences
      userSkillReferences.value = transcript.userSkillReferences
      historySkillNames.value = [
        ...new Set(
          [...transcript.userSkillReferences.values()].map(({ name }) => name)
        )
      ]
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
            (snapshot) => publishMessage(pending.messageId, snapshot),
            (workflowId) => canvasSyncGate(workflowId),
            () => canvasSyncOutcomeCount(),
            reportUndeliverableAskData
          ),
          tab:
            replacedSlot?.turnId === pending.messageId
              ? replacedSlot.tab
              : resolveTurnTab()
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
        const skillReference = userSkillReferences.value.get(message.id)
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
            workflowReferences: userWorkflowReferences.value.get(message.id),
            ...(skillReference ? { skillReference } : {})
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
          (part) => isPendingAskPart(part) && part.askId === askId
        ) ?? false
      )
    }

    const activeMessageId = computed(() => activeMessage.value?.id ?? null)
    const isStreaming = computed(() => activeMessage.value?.streaming ?? false)

    function awaitsAnswer(approvalAskIds: readonly string[]): boolean {
      return approvalAskIds.some((askId) => !answeringAskIds.value.has(askId))
    }

    const activeTurnTabPath = computed(() => {
      const slot = activeSlot.value
      return slot !== null && isStreaming.value ? openPathOf(slot.tab) : null
    })
    const activeTurnAwaitsAnswer = computed(() =>
      activeMessage.value
        ? awaitsAnswer(runApprovalAskIds(activeMessage.value))
        : false
    )
    const turnTabs = computed<AgentTurnTab[]>(() => {
      const activePath = activeTurnTabPath.value
      const background = [...backgroundTurns.values()].flatMap(
        ({ settled, tab, approvalAskIds }) => {
          const path = settled ? null : openPathOf(tab)
          return path === null
            ? []
            : [{ path, awaitingApproval: awaitsAnswer(approvalAskIds) }]
        }
      )
      return activePath === null
        ? background
        : [
            {
              path: activePath,
              awaitingApproval: activeTurnAwaitsAnswer.value
            },
            ...background
          ]
    })
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
      activeTurnTabPath,
      turnTabs,
      onTurnCompleted: turnCompleted.on,
      setTurnTabResolver,
      moveTurnToTab,
      adoptThreadTab,
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
      recordAskAnswer,
      takeSubmittedAskAnswer,
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
      turnUsesSkill,
      historySkillNames,
      settleTurn,
      reset,
      hydrate
    }
  }
)
