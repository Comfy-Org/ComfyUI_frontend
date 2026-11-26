import type { AgentAnswerRequest } from '@comfyorg/ingest-types'
import { createEventHook } from '@vueuse/core'
import { isEqual } from 'es-toolkit'
import { defineStore } from 'pinia'
import { computed, ref, shallowReactive, shallowRef, watch } from 'vue'

import type { MediaKind } from '@comfyorg/assets-core/media'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { AgentTurnTab } from '@/stores/workflowTabActivityStore'

import type {
  AgentMessages,
  RenderedAskKind,
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
  AssistantMessage,
  ToolPart
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import {
  askIdOf,
  askKindOf,
  createAssistantMessage,
  isOpenAskPart,
  isPendingAskPart,
  retireAskParts,
  settleResolution,
  snapshotMessage
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import type {
  KnownChatState,
  KnownTurnSnapshot
} from '@/workbench/extensions/agent/services/agent/agentKnownChat'
import {
  alignKnownChatHistory,
  latestWorkflowIdOf,
  pruneSettledLocalTurns
} from '@/workbench/extensions/agent/services/agent/agentKnownChat'
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
import type {
  AgentInputMethod,
  AgentStopMethod
} from '@comfyorg/telemetry/types'
import type { AgentStarterPromptSource } from '@/workbench/extensions/agent/utils/starterPrompts'
import { parseSkillReferenceText } from '@/workbench/extensions/agent/utils/skillReferenceText'
import type { HydratedUserTurn } from '@/workbench/extensions/agent/utils/workflowReferenceText'
import { matchesHydratedUserTurn } from '@/workbench/extensions/agent/utils/workflowReferenceText'

export type { UserAttachment }

type ConversationStatus = 'idle' | 'thinking' | 'streaming'

export type PendingSendOrigin =
  | { kind: 'thread'; threadId: string }
  | { kind: 'blank'; blankChatId: string }

type PendingSendStatus = 'sending' | 'failed'

type PendingSendFailureKind =
  | 'network'
  | 'admission'
  | 'paywall'
  | 'retry_after'
  | 'disowned'
  | 'target_unavailable'
  | 'turn_in_progress'
  | 'request'

export interface PendingSendFailure {
  kind: PendingSendFailureKind
  message: string
  retryAfterSeconds?: number
  retryAtMs?: number
  retryable?: boolean
  uncertain?: boolean
}

export interface PendingSendEntryState {
  clientMessageId: string
  status: PendingSendStatus
  failure?: PendingSendFailure
  paywallResolved?: boolean
}

interface PendingSendStop {
  method?: AgentStopMethod
}

export interface PendingSentAttachment {
  ref: string
  name: string
  previewUrl?: string
  mediaUrl?: string
  mediaKind?: MediaKind
}

interface PendingSentTag {
  id: string
  title: string
}

interface PendingSend {
  clientMessageId: string
  origin: PendingSendOrigin
  workspaceId?: string | null
  rawText: string
  text: string
  attachments: UserAttachment[]
  sentAttachments: PendingSentAttachment[]
  sentTags: PendingSentTag[]
  tags: string[]
  workflowReferences: WorkflowReference[]
  skillReference?: SkillReference
  assetIds?: readonly string[]
  targetTabPath?: string | null
  targetTabInstanceId?: string | null
  inputMethod?: AgentInputMethod
  starterPrompt?: AgentStarterPromptSource | null
  status: PendingSendStatus
  failure?: PendingSendFailure
  paywallResolved?: boolean
  stopRequested?: PendingSendStop
  canvasOutcomeAtStart?: number
  canvasEvidence?: CanvasSyncEvidence[]
  knownTurnIdsAtSend?: ReadonlySet<string>
  precedesThreadTranscript?: boolean
  createdOrder: number
}

interface TranscriptHydratedEvent {
  threadId: string
  userTurns: readonly HydratedUserTurn[]
}

interface BlankChatFailuresBoundEvent {
  clientMessageIds: readonly string[]
  threadId: string
  acceptedTurnId: TurnId
}

interface UserEntry {
  id: TurnId
  role: 'user'
  text: string
  attachments?: UserAttachment[]
  tags?: string[]
  workflowReferences?: WorkflowReference[]
  skillReference?: SkillReference
  pending?: PendingSendEntryState
}

export type ConversationEntry = UserEntry | AssistantMessage

interface BackgroundTurn {
  threadId: string
  messageId: TurnId
  message: AssistantMessage
  transport: AgentEventTransport
  userText: string | undefined
  attachments?: UserAttachment[]
  tags?: string[]
  workflowReferences?: WorkflowReference[]
  skillReference?: SkillReference
  settled: boolean
  tab: TurnTab
  pendingAskIds: readonly string[]
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

const KEPT_KNOWN_CHATS = 12

function settledCopyOf(message: AssistantMessage): AssistantMessage {
  const copy = snapshotMessage(message)
  if (copy.streaming) settleLiveMessage(copy)
  return copy
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

function pendingAskIdsOf(message: AssistantMessage): string[] {
  return message.parts.flatMap((part) =>
    isPendingAskPart(part) ? [part.askId] : []
  )
}

function reopenAsk(message: AssistantMessage, askId: string): void {
  message.parts = message.parts.map((part) =>
    (part.type === 'askUser' || part.type === 'deleteApproval') &&
    askIdOf(part) === askId
      ? { ...part, resolution: undefined }
      : part
  )
}

export interface LiveTurn {
  threadId: string
  messageId: TurnId
}

interface UnreconciledSnapshotTurn {
  turn: LiveTurn
  messageId: string
  transport: AgentEventTransport
  announced: boolean
  missedFrom: 'reload' | 'reconnect'
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

function preserveLiveToolStartTimes(
  persistedParts: AssistantMessage['parts'],
  liveParts: AssistantMessage['parts']
): AssistantMessage['parts'] {
  const startsByCallId = new Map<string, number>()
  for (const part of liveParts) {
    if (part.type === 'tool' && part.startedAtMs !== undefined)
      startsByCallId.set(part.callId, part.startedAtMs)
  }
  return persistedParts.map((part) => {
    if (part.type !== 'tool' || part.startedAtMs !== undefined) return part
    const startedAtMs = startsByCallId.get(part.callId)
    return startedAtMs === undefined ? part : { ...part, startedAtMs }
  })
}

function toolCallIdsOf(parts: AssistantMessage['parts']): string[] {
  return parts.flatMap((part) => (part.type === 'tool' ? [part.callId] : []))
}

function liveToolOffset(
  liveParts: AssistantMessage['parts'],
  persistedParts: AssistantMessage['parts']
): number {
  const live = toolCallIdsOf(liveParts)
  const persisted = toolCallIdsOf(persistedParts)
  if (live.length === 0) return persisted.length
  for (const [index, callId] of live.entries()) {
    const at = persisted.indexOf(callId)
    if (at >= index) return at - index
  }
  return Math.max(0, persisted.length - live.length)
}

function storedCallIdOf(
  liveParts: AssistantMessage['parts'],
  persistedParts: AssistantMessage['parts'],
  offset: number
): (callId: string) => string {
  const liveCallIds = toolCallIdsOf(liveParts)
  const persistedCallIds = toolCallIdsOf(persistedParts)
  const persisted = new Set(persistedCallIds)
  const live = new Set(liveCallIds)
  return (callId) => {
    if (persisted.has(callId)) return callId
    const position = liveCallIds.indexOf(callId) + offset
    const atPosition =
      position < persistedCallIds.length
        ? persistedCallIds.at(position)
        : undefined
    return atPosition !== undefined && !live.has(atPosition)
      ? atPosition
      : callId
  }
}

function preserveCanvasVerdicts(
  liveParts: AssistantMessage['parts'],
  persistedParts: AssistantMessage['parts'],
  alignedOffset: number | 'exact-ids' = liveToolOffset(
    liveParts,
    persistedParts
  )
): AssistantMessage['parts'] {
  const exactIdsOnly = alignedOffset === 'exact-ids'
  const offset = exactIdsOnly ? 0 : alignedOffset
  const storedCallId = storedCallIdOf(liveParts, persistedParts, offset)
  const liveTools = toolPartsOf(liveParts)
  const persistedCallIds = new Set(toolCallIdsOf(persistedParts))
  const liveCounts = toolNameCounts(liveTools)
  const alignedCounts = toolNameCounts(
    toolPartsOf(persistedParts).slice(offset, offset + liveTools.length)
  )
  const liveByStoredCallId = new Map<string, ToolPart>()
  for (const part of liveTools) {
    if (
      !persistedCallIds.has(part.callId) &&
      (exactIdsOnly ||
        liveCounts.get(part.name) !== alignedCounts.get(part.name))
    )
      continue
    liveByStoredCallId.set(storedCallId(part.callId), part)
  }
  return persistedParts.map((part) => {
    if (part.type !== 'tool' || part.ok !== true) return part
    const live = liveByStoredCallId.get(part.callId)
    if (live?.name !== part.name) return part
    const canvasConfirmed = liveCanvasVerdict(live)
    return canvasConfirmed === undefined ? part : { ...part, canvasConfirmed }
  })
}

function toolPartsOf(parts: AssistantMessage['parts']): ToolPart[] {
  return parts.filter((part): part is ToolPart => part.type === 'tool')
}

function toolNameCounts(tools: ToolPart[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const tool of tools)
    counts.set(tool.name, (counts.get(tool.name) ?? 0) + 1)
  return counts
}

function liveCanvasVerdict(part: ToolPart): boolean | undefined {
  if (part.canvasConfirmed !== undefined) return part.canvasConfirmed
  return part.ok === true && part.state === 'streaming' ? false : undefined
}

function finishSnapshotTurn(
  message: AssistantMessage,
  persistedParts: AssistantMessage['parts']
): void {
  const offset = liveToolOffset(message.parts, persistedParts)
  finishWithPersistedParts(message, persistedParts, {
    canvasOffset: offset,
    toolCountOf: behindLiveCallId(message.parts, persistedParts, offset)
  })
}

function finishReconnectedTurn(
  message: AssistantMessage,
  persistedParts: AssistantMessage['parts']
): void {
  finishWithPersistedParts(message, persistedParts, {
    canvasOffset: 'exact-ids',
    toolCountOf: behindLiveCallId(message.parts, persistedParts, 0)
  })
}

function behindLiveCallId(
  liveParts: AssistantMessage['parts'],
  persistedParts: AssistantMessage['parts'],
  offset: number
): (liveToolCount: number) => number {
  const liveCallIds = toolCallIdsOf(liveParts)
  const persistedCallIds = toolCallIdsOf(persistedParts)
  return (toolCount) => {
    if (toolCount === 0) return offset
    const at = persistedCallIds.indexOf(liveCallIds[toolCount - 1])
    return at < 0 ? toolCount + offset : at + 1
  }
}

interface LocalPartAlignment {
  canvasOffset?: number | 'exact-ids'
  toolCountOf: (liveToolCount: number) => number
}

function finishActiveTurn(
  slot: Pick<ActiveTurnSlot, 'origin' | 'message'>,
  persistedParts: AssistantMessage['parts'] | undefined,
  missedFrames: boolean
): void {
  if (persistedParts === undefined)
    finishWithPersistedParts(slot.message, persistedParts)
  else if (slot.origin === 'snapshot')
    finishSnapshotTurn(slot.message, persistedParts)
  else if (missedFrames) finishReconnectedTurn(slot.message, persistedParts)
  else finishWithPersistedParts(slot.message, persistedParts)
}

function finishWithPersistedParts(
  message: AssistantMessage,
  persistedParts: AssistantMessage['parts'] | undefined,
  alignment: LocalPartAlignment = { toolCountOf: (toolCount) => toolCount }
): void {
  if (persistedParts === undefined) {
    message.parts = message.parts.filter((part) => !isOpenAskPart(part))
    for (const part of message.parts) {
      if (!('state' in part) || part.state !== 'streaming') continue
      if (part.type === 'tool' && part.ok !== undefined) continue
      part.state = 'done'
    }
    return
  }
  const persistedHasThinking = persistedParts.some(
    (part) => part.type === 'thinking'
  )
  message.parts = interleaveLocalParts(
    preserveLiveToolStartTimes(
      preserveCanvasVerdicts(
        message.parts,
        persistedParts,
        alignment.canvasOffset
      ),
      message.parts
    ),
    anchorLocalParts(message.parts)
      .filter(({ part }) => !persistedHasThinking || part.type !== 'thinking')
      .map((anchor) => ({
        ...anchor,
        toolCount: alignment.toolCountOf(anchor.toolCount)
      }))
  )
}

const MAX_DEPARTED_TURNS = 32
let blankChatCounter = 0

function nextBlankChatId(): string {
  return `blank-${++blankChatCounter}`
}

interface SubmittedAskAnswer {
  answer: AgentAnswerRequest
  kind: RenderedAskKind | 'unknown'
  owner: string
  awaitingResolution?: 'accepted' | 'conflict'
}

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
    const activeBlankChatId = ref<string>(nextBlankChatId())
    const pendingSends = shallowReactive(new Map<string, PendingSend>())
    let nextPendingSendOrder = 0
    let resolveTurnTab: () => TurnTab = () => UNKNOWN_TAB
    const turnCompleted = createEventHook<string>()
    const unreconciledSnapshotTurns = new Map<
      TurnId,
      UnreconciledSnapshotTurn
    >()
    const snapshotTurnSettled = createEventHook<LiveTurn>()
    const pendingSendsReconciled = createEventHook<readonly string[]>()
    const transcriptHydrated = createEventHook<TranscriptHydratedEvent>()
    const blankChatFailuresBound =
      createEventHook<BlankChatFailuresBoundEvent>()
    const missedFrameTurnIds = new Set<TurnId>()
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
    const approvalShownAtByAsk = new Map<
      string,
      { shownAt: number; turnId: string }
    >()
    const shownApprovalIds = new Set<string>()
    const reportedTurnCredits = new Map<TurnId, number>()
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

    function refreshBackgroundAskIds(entry: BackgroundTurn): void {
      const pendingAskIds = pendingAskIdsOf(entry.message)
      if (!isEqual(pendingAskIds, entry.pendingAskIds))
        updateBackgroundTurn(entry.messageId, { pendingAskIds })
    }

    function updateBackgroundTurn(
      turnId: TurnId,
      change: Partial<Pick<BackgroundTurn, 'settled' | 'tab' | 'pendingAskIds'>>
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

    function rememberReportedCharge(
      turnId: TurnId,
      message: AssistantMessage
    ): void {
      if (message.creditsUsed !== undefined)
        reportedTurnCredits.set(turnId, message.creditsUsed)
    }

    function publishMessage(turnId: TurnId, message: AssistantMessage): void {
      rememberReportedCharge(turnId, message)
      replaceActive(message)
      const entry = backgroundTurns.get(turnId)
      if (activeSlot.value?.turnId !== turnId && (!entry || entry.settled))
        syncKnownTurnMessage(entry?.threadId ?? threadId.value, turnId, message)
      const unreconciled = unreconciledSnapshotTurns.get(turnId)
      if (unreconciled !== undefined)
        announceReconcilableSnapshotTurn(unreconciled)
      if (entry) refreshBackgroundAskIds(entry)
    }

    function recordApprovalShown(
      askId: string,
      turnId: string,
      shownAt: number
    ): boolean {
      if (shownApprovalIds.has(askId)) return false
      shownApprovalIds.add(askId)
      approvalShownAtByAsk.set(askId, { shownAt, turnId })
      return true
    }

    function approvalShownAt(askId: string): number | undefined {
      return approvalShownAtByAsk.get(askId)?.shownAt
    }

    function approvalTurnId(askId: string): string | undefined {
      return approvalShownAtByAsk.get(askId)?.turnId
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
      for (const [id, send] of pendingSends) {
        if (send.failure?.kind === 'paywall' && !send.paywallResolved) {
          pendingSends.set(id, { ...send, paywallResolved: true })
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
      owner?: string,
      permanent = true
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
      const known = knownChats.get(key)
      if (known) {
        for (const turn of known.localTurns) {
          const parts = retireAskParts(turn.message.parts, askId, resolution)
          if (parts !== turn.message.parts)
            turn.message = { ...turn.message, parts }
        }
      }
      if (permanent) {
        const retired = retiredAsksFor(key)
        retired.set(askId, settleResolution(retired.get(askId), resolution))
        provisionalRetiredAsksFor(key).delete(askId)
      } else provisionalRetiredAsksFor(key).add(askId)
      clearAskResolutionWatchdog(askId)
      submittedAskAnswers.delete(askId)
      setAskAnswering(askId, false)
    }

    const retiredAsks = new Map<string, Map<string, AskUserResolution>>()
    const provisionalRetiredAsks = new Map<string, Set<string>>()

    const threadKey = (owner?: string) => owner ?? threadId.value ?? ''

    function retiredAsksFor(owner?: string): Map<string, AskUserResolution> {
      const key = threadKey(owner)
      const retired =
        retiredAsks.get(key) ?? new Map<string, AskUserResolution>()
      retiredAsks.set(key, retired)
      return retired
    }

    function provisionalRetiredAsksFor(owner?: string): Set<string> {
      const key = threadKey(owner)
      const retired = provisionalRetiredAsks.get(key) ?? new Set<string>()
      provisionalRetiredAsks.set(key, retired)
      return retired
    }
    function isAskRetired(askId: string, owner?: string): boolean {
      const key = threadKey(owner)
      return (
        retiredAsks.get(key)?.has(askId) === true ||
        provisionalRetiredAsks.get(key)?.has(askId) === true
      )
    }

    function isAskPermanentlyRetired(askId: string, owner?: string): boolean {
      return retiredAsks.get(threadKey(owner))?.has(askId) === true
    }

    function confirmAskPending(askId: string, owner?: string): void {
      const key = threadKey(owner)
      const provisional = provisionalRetiredAsks.get(key)
      if (provisional?.delete(askId) !== true) return
      if (provisional.size === 0) provisionalRetiredAsks.delete(key)
      if (retiredAsks.get(key)?.has(askId) === true) return
      reopenAskInThread(key, askId)
    }

    function reopenAskInThread(key: string, askId: string): void {
      const reopen = (message: AssistantMessage) => reopenAsk(message, askId)
      if (activeSlot.value?.threadId === key) reopen(activeSlot.value.message)
      for (const entry of backgroundTurns.values())
        if (entry.threadId === key) {
          reopen(entry.message)
          refreshBackgroundAskIds(entry)
        }
      if (key === threadKey()) messages.value.forEach(reopen)
      const known = knownChats.get(key)
      if (known) {
        for (const turn of known.localTurns) reopenAsk(turn.message, askId)
      }
    }

    const submittedAskAnswers = new Map<string, SubmittedAskAnswer>()

    function recordAskAnswer(
      askId: string,
      answer: AgentAnswerRequest,
      owner?: string
    ): void {
      const kind =
        messages.value
          .map((message) => askKindOf(message.parts, askId))
          .find((found) => found !== undefined) ?? 'unknown'
      submittedAskAnswers.set(askId, {
        answer,
        kind,
        owner: threadKey(owner)
      })
    }

    function submittedAskAnswer(askId: string): AgentAnswerRequest | undefined {
      return submittedAskAnswers.get(askId)?.answer
    }

    function takeSubmittedAskAnswer(
      askId: string
    ): SubmittedAskAnswer | undefined {
      const answer = submittedAskAnswers.get(askId)
      submittedAskAnswers.delete(askId)
      return answer
    }

    function markAskAwaitingResolution(
      askId: string,
      kind: 'accepted' | 'conflict'
    ): void {
      const submitted = submittedAskAnswers.get(askId)
      if (submitted) submitted.awaitingResolution = kind
    }

    function asksAwaitingResolution(): Array<{
      askId: string
      kind: 'accepted' | 'conflict'
    }> {
      return [...submittedAskAnswers]
        .filter(([, submitted]) => submitted.awaitingResolution !== undefined)
        .map(([askId, submitted]) => ({
          askId,
          kind: submitted.awaitingResolution!
        }))
    }

    function clearAskAwaitingResolution(askId: string): void {
      const submitted = submittedAskAnswers.get(askId)
      if (submitted) submitted.awaitingResolution = undefined
    }

    function clearSettledAskState(owner: string): void {
      provisionalRetiredAsks.delete(owner)
      for (const [askId, submitted] of submittedAskAnswers)
        if (submitted.owner === owner) submittedAskAnswers.delete(askId)
    }

    function discardDetachedAskState(): void {
      const retainedThreads = new Set(
        [...backgroundTurns.values()].map((turn) => turn.threadId)
      )
      for (const owner of retiredAsks.keys())
        if (!retainedThreads.has(owner)) retiredAsks.delete(owner)
      for (const owner of provisionalRetiredAsks.keys())
        if (!retainedThreads.has(owner)) provisionalRetiredAsks.delete(owner)
      for (const [askId, submitted] of submittedAskAnswers)
        if (!retainedThreads.has(submitted.owner))
          submittedAskAnswers.delete(askId)
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

    function currentOrigin(): PendingSendOrigin {
      return threadId.value !== null
        ? { kind: 'thread', threadId: threadId.value }
        : { kind: 'blank', blankChatId: activeBlankChatId.value }
    }

    function originsEqual(a: PendingSendOrigin, b: PendingSendOrigin): boolean {
      return a.kind === 'thread' && b.kind === 'thread'
        ? a.threadId === b.threadId
        : a.kind === 'blank' &&
            b.kind === 'blank' &&
            a.blankChatId === b.blankChatId
    }

    function isOriginOnScreen(origin: PendingSendOrigin): boolean {
      return originsEqual(origin, currentOrigin())
    }

    const pendingSendsForCurrentChat = computed(() =>
      [...pendingSends.values()].filter((send) => isOriginOnScreen(send.origin))
    )

    const hasSendingPendingSend = computed(() =>
      pendingSendsForCurrentChat.value.some((send) => send.status === 'sending')
    )

    function hasSendingForOrigin(
      origin: PendingSendOrigin,
      excludeClientMessageId?: string
    ): boolean {
      for (const send of pendingSends.values())
        if (
          send.status === 'sending' &&
          send.clientMessageId !== excludeClientMessageId &&
          originsEqual(send.origin, origin)
        )
          return true
      return false
    }

    function hasLiveTurnForOrigin(origin: PendingSendOrigin): boolean {
      if (origin.kind !== 'thread') return false
      return liveTurns().some((turn) => turn.threadId === origin.threadId)
    }

    function isOriginBusy(origin: PendingSendOrigin): boolean {
      return hasSendingForOrigin(origin) || hasLiveTurnForOrigin(origin)
    }

    function startPendingSend(input: {
      clientMessageId: string
      origin?: PendingSendOrigin
      workspaceId?: string | null
      rawText?: string
      text: string
      attachments: UserAttachment[]
      sentAttachments?: PendingSentAttachment[]
      sentTags?: PendingSentTag[]
      tags: string[]
      workflowReferences: WorkflowReference[]
      assetIds?: readonly string[]
      targetTabPath?: string | null
      targetTabInstanceId?: string | null
      inputMethod?: AgentInputMethod
      starterPrompt?: AgentStarterPromptSource | null
    }): PendingSend {
      const parsed = parseSkillReferenceText(
        input.text,
        input.workflowReferences
      )
      const origin = input.origin ?? currentOrigin()
      const knownTurnIdsAtSend =
        origin.kind === 'thread' && isOriginOnScreen(origin)
          ? new Set(knownUserTurnIds())
          : undefined
      const record: PendingSend = {
        ...input,
        workspaceId: input.workspaceId ?? null,
        rawText: input.rawText ?? input.text,
        sentAttachments: input.sentAttachments ?? [],
        sentTags: input.sentTags ?? [],
        origin,
        text: parsed.text,
        workflowReferences: parsed.workflowReferences,
        skillReference: parsed.skillReference,
        knownTurnIdsAtSend,
        status: 'sending',
        createdOrder: ++nextPendingSendOrder
      }
      pendingSends.set(record.clientMessageId, record)
      return record
    }

    const displayedTurnServerIds = new Map<TurnId, Set<string>>()

    function recordDisplayedTurnAliases(
      serverTurnToLocal: ReadonlyMap<string, TurnId>
    ): void {
      for (const [serverTurnId, localTurnId] of serverTurnToLocal) {
        if (serverTurnId === localTurnId) continue
        let aliases = displayedTurnServerIds.get(localTurnId)
        if (!aliases) {
          aliases = new Set()
          displayedTurnServerIds.set(localTurnId, aliases)
        }
        aliases.add(serverTurnId)
      }
    }

    function knownUserTurnIds(): TurnId[] {
      const ids = new Set<TurnId>(userTexts.value.keys())
      for (const [localTurnId, aliases] of displayedTurnServerIds) {
        if (!userTexts.value.has(localTurnId)) continue
        for (const serverTurnId of aliases) ids.add(toTurnId(serverTurnId))
      }
      return [...ids]
    }

    function capturePendingSendCanvasBaseline(clientMessageId: string): void {
      const existing = pendingSends.get(clientMessageId)
      if (!existing || existing.status !== 'sending') return
      pendingSends.set(clientMessageId, {
        ...existing,
        canvasOutcomeAtStart: canvasSyncOutcomeCount(),
        canvasEvidence: []
      })
    }

    function failPendingSend(
      clientMessageId: string,
      failure: PendingSendFailure
    ): boolean {
      const existing = pendingSends.get(clientMessageId)
      if (!existing) return false
      const normalizedFailure: PendingSendFailure =
        failure.retryAfterSeconds !== undefined &&
        failure.retryAtMs === undefined
          ? {
              ...failure,
              retryAtMs: Date.now() + failure.retryAfterSeconds * 1000
            }
          : failure
      pendingSends.set(clientMessageId, {
        ...existing,
        status: 'failed',
        failure: normalizedFailure,
        paywallResolved: undefined,
        canvasOutcomeAtStart: undefined,
        canvasEvidence: undefined
      })
      return true
    }

    function retryPendingSend(
      oldClientMessageId: string,
      newClientMessageId: string
    ): PendingSend | undefined {
      const existing = pendingSends.get(oldClientMessageId)
      if (!existing) return undefined
      const updated: PendingSend = {
        ...existing,
        clientMessageId: newClientMessageId,
        knownTurnIdsAtSend:
          existing.origin.kind === 'thread' && isOriginOnScreen(existing.origin)
            ? new Set([
                ...(existing.knownTurnIdsAtSend ?? []),
                ...knownUserTurnIds()
              ])
            : existing.knownTurnIdsAtSend,
        precedesThreadTranscript: undefined,
        status: 'sending',
        failure: undefined,
        paywallResolved: undefined,
        stopRequested: undefined,
        canvasOutcomeAtStart: undefined,
        canvasEvidence: undefined
      }
      const entriesInOrder = [...pendingSends.entries()]
      pendingSends.clear()
      for (const [key, value] of entriesInOrder) {
        if (key === oldClientMessageId) {
          pendingSends.set(newClientMessageId, updated)
        } else {
          pendingSends.set(key, value)
        }
      }
      return updated
    }

    function markPendingSendStopped(
      origin: PendingSendOrigin,
      method?: PendingSendStop['method']
    ): boolean {
      let marked = false
      for (const [id, send] of pendingSends) {
        if (send.status !== 'sending' || !originsEqual(send.origin, origin))
          continue
        pendingSends.set(id, { ...send, stopRequested: { method } })
        marked = true
      }
      return marked
    }

    function takePendingSend(clientMessageId: string): PendingSend | undefined {
      const existing = pendingSends.get(clientMessageId)
      if (!existing) return undefined
      pendingSends.delete(clientMessageId)
      return existing
    }

    function isAdoptableBlankFailure(
      send: PendingSend,
      blankChatId: string,
      workspaceId: string | null
    ): boolean {
      if (send.origin.kind !== 'blank') return false
      if (send.origin.blankChatId !== blankChatId) return false
      if (send.status !== 'failed' || send.failure?.uncertain === true)
        return false
      return (send.workspaceId ?? null) === workspaceId
    }

    function bindCertainBlankChatFailures(
      blankChatId: string,
      threadId: string,
      acceptedTurnId: TurnId,
      workspaceId: string | null,
      acceptedOrder?: number
    ): void {
      const boundIds: string[] = []
      for (const [id, send] of pendingSends) {
        if (!isAdoptableBlankFailure(send, blankChatId, workspaceId)) continue
        const precedesThreadTranscript =
          acceptedOrder === undefined || send.createdOrder < acceptedOrder
            ? true
            : undefined
        pendingSends.set(id, {
          ...send,
          origin: { kind: 'thread', threadId },
          knownTurnIdsAtSend: new Set([acceptedTurnId]),
          precedesThreadTranscript
        })
        boundIds.push(id)
      }
      if (boundIds.length > 0)
        void blankChatFailuresBound.trigger({
          clientMessageIds: boundIds,
          threadId,
          acceptedTurnId
        })
    }

    function getPendingSend(clientMessageId: string): PendingSend | undefined {
      return pendingSends.get(clientMessageId)
    }

    function hasPendingSendForOrigin(
      origin: PendingSendOrigin,
      workspaceId?: string | null
    ): boolean {
      for (const send of pendingSends.values()) {
        if (
          originsEqual(send.origin, origin) &&
          (workspaceId === undefined ||
            (send.workspaceId ?? null) === workspaceId)
        )
          return true
      }
      return false
    }

    function hasPendingSendForBlankChat(
      blankChatId: string,
      workspaceId?: string | null
    ): boolean {
      return hasPendingSendForOrigin(
        { kind: 'blank', blankChatId },
        workspaceId
      )
    }

    function discardPendingSendsOutsideWorkspace(
      activeWorkspaceId: string | null,
      excludeClientMessageId?: string
    ): string[] {
      const removed: string[] = []
      for (const [id, send] of pendingSends) {
        if (
          send.status !== 'failed' ||
          id === excludeClientMessageId ||
          (send.workspaceId ?? null) === activeWorkspaceId
        )
          continue
        pendingSends.delete(id)
        removed.push(id)
      }
      return removed
    }

    const tabBlankChatIds = new Map<string, string>()
    const blankChatTabs = new Map<string, string>()
    let hasAssignedBlankTab = false

    watch(openTabPaths, (nextOpen, prevOpen) => {
      for (const tabKey of prevOpen.keys()) {
        if (nextOpen.has(tabKey)) continue
        tabBlankChatIds.delete(tabKey)
        for (const [blankChatId, mappedTabKey] of blankChatTabs) {
          if (mappedTabKey === tabKey) blankChatTabs.delete(blankChatId)
        }
      }
    })

    function setBlankChatIdForTab(tabKey: string, blankChatId: string): void {
      tabBlankChatIds.set(tabKey, blankChatId)
      blankChatTabs.set(blankChatId, tabKey)
    }

    function tabKeyForBlankChat(blankChatId: string): string | null {
      return blankChatTabs.get(blankChatId) ?? null
    }

    function adoptInitialBlankTab(tabKey: string | null): void {
      if (hasAssignedBlankTab || threadId.value !== null) return
      if (hasPendingSendForOrigin(currentOrigin())) return
      if (tabKey === null) return
      const blankChatId = blankChatIdForTab(tabKey)
      activeBlankChatId.value = blankChatId
      hasAssignedBlankTab = true
    }

    function blankChatIdForTab(tabKey: string | null): string {
      const key = tabKey ?? ''
      const blankChatId = tabBlankChatIds.get(key) ?? `blank:${key}`
      if (tabKey !== null) blankChatTabs.set(blankChatId, tabKey)
      return blankChatId
    }

    function advanceBlankChatIdForTab(tabKey: string | null): string {
      const next = nextBlankChatId()
      const key = tabKey ?? ''
      tabBlankChatIds.set(key, next)
      if (tabKey !== null) blankChatTabs.set(next, tabKey)
      return next
    }

    function discardFailedPendingSends(
      origin: PendingSendOrigin,
      workspaceId?: string | null
    ): string[] {
      const discardedIds: string[] = []
      for (const [id, send] of pendingSends) {
        if (
          send.status === 'failed' &&
          originsEqual(send.origin, origin) &&
          (workspaceId === undefined ||
            (send.workspaceId ?? null) === workspaceId)
        ) {
          pendingSends.delete(id)
          discardedIds.push(id)
        }
      }
      return discardedIds
    }
    function updatePendingAttachmentPreview(
      id: string,
      previewUrl: string
    ): void {
      for (const [sendId, send] of pendingSends) {
        if (!send.assetIds?.includes(id)) continue
        pendingSends.set(sendId, {
          ...send,
          sentAttachments: send.sentAttachments.map((item, index) =>
            send.assetIds?.[index] === id ? { ...item, previewUrl } : item
          ),
          attachments: send.attachments.map((item, index) =>
            send.assetIds?.[index] === id ? { ...item, previewUrl } : item
          )
        })
      }
    }

    function rememberThreadAttachmentNames(
      targetThreadId: string,
      attachments: UserAttachment[] | undefined
    ): void {
      if (!attachments?.length) return
      const names = attachmentNamesByThread.get(targetThreadId) ?? new Map()
      for (const attachment of attachments)
        if (attachment.ref) names.set(attachment.ref, attachment.name)
      attachmentNamesByThread.set(targetThreadId, names)
    }

    function startBackgroundTurn(input: {
      threadId: string
      turnId: TurnId
      text: string
      attachments?: UserAttachment[]
      tags?: string[]
      workflowReferences?: WorkflowReference[]
      tab: TurnTab
      canvasBaseline?: {
        outcomeAtStart?: number
        evidence?: readonly CanvasSyncEvidence[]
      }
    }): void {
      const parsed = parseSkillReferenceText(
        input.text,
        input.workflowReferences
      )
      rememberThreadAttachmentNames(input.threadId, input.attachments)
      const message = createAssistantMessage(input.turnId)
      const transport = createAgentEventTransport(
        message,
        (snapshot) => publishMessage(input.turnId, snapshot),
        (workflowId) => canvasSyncGate(workflowId),
        () => canvasSyncOutcomeCount(),
        reportUndeliverableAskData,
        input.canvasBaseline?.outcomeAtStart
      )
      for (const evidence of input.canvasBaseline?.evidence ?? [])
        transport.notifyCanvasCaughtUp(evidence)
      backgroundTurns.set(input.turnId, {
        threadId: input.threadId,
        messageId: input.turnId,
        message,
        transport,
        userText: parsed.text,
        attachments: input.attachments,
        tags: input.tags,
        workflowReferences: parsed.workflowReferences,
        skillReference: parsed.skillReference,
        settled: false,
        tab: input.tab,
        pendingAskIds: []
      })
    }

    function startTurn(
      turnId: TurnId,
      canvasBaseline?: {
        outcomeAtStart?: number
        evidence?: readonly CanvasSyncEvidence[]
      }
    ): void {
      if (activeSlot.value) abortActiveTurn()
      const message = createAssistantMessage(turnId)
      const transport = createAgentEventTransport(
        message,
        (snapshot) => publishMessage(turnId, snapshot),
        (workflowId) => canvasSyncGate(workflowId),
        () => canvasSyncOutcomeCount(),
        reportUndeliverableAskData,
        canvasBaseline?.outcomeAtStart
      )
      for (const evidence of canvasBaseline?.evidence ?? [])
        transport.notifyCanvasCaughtUp(evidence)
      activeSlot.value = {
        origin: 'local',
        turnId,
        index: messages.value.push(message) - 1,
        threadId: threadId.value,
        message,
        transport,
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
        activeTransport.ingest(event)
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
      const slot = activeSlot.value
      rememberDepartedActiveTurn('settled-turn')
      activeTransport.settle()
      if (slot) syncKnownTurnMessage(slot.threadId, slot.turnId, slot.message)
      const restoredFromSnapshot = recordUnreconciledSnapshotTurn()
      if (activeTransport.hasPendingCanvasSync())
        settledActiveTransports.add(activeTransport)
      clearActive()
      if (restoredFromSnapshot)
        announceReconcilableSnapshotTurn(restoredFromSnapshot)
    }

    function recordUnreconciledSnapshotTurn():
      | UnreconciledSnapshotTurn
      | undefined {
      const slot = activeSlot.value
      if (slot === null || slot.threadId === null) return undefined
      const missedFrames = missedFrameTurnIds.delete(slot.turnId)
      if (slot.origin !== 'snapshot' && !missedFrames) return undefined
      const unreconciled: UnreconciledSnapshotTurn = {
        turn: { threadId: slot.threadId, messageId: slot.turnId },
        messageId: slot.message.id,
        transport: slot.transport,
        announced: false,
        missedFrom: slot.origin === 'snapshot' ? 'reload' : 'reconnect'
      }
      unreconciledSnapshotTurns.set(slot.turnId, unreconciled)
      return unreconciled
    }

    function announceReconcilableSnapshotTurn(
      unreconciled: UnreconciledSnapshotTurn
    ): void {
      if (
        unreconciled.announced ||
        unreconciled.transport.hasPendingCanvasSync()
      )
        return
      settledActiveTransports.delete(unreconciled.transport)
      unreconciled.announced = true
      void snapshotTurnSettled.trigger(unreconciled.turn)
    }

    /** Frames may be missing: reconcile the active turn with its stored row. */
    function markActiveTurnMissedFrames(): void {
      const slot = activeSlot.value
      if (slot !== null) missedFrameTurnIds.add(slot.turnId)
    }

    function reconcileSettledTurn(
      turn: LiveTurn,
      persistedParts: AssistantMessage['parts'] | undefined
    ): void {
      const unreconciled = unreconciledSnapshotTurns.get(turn.messageId)
      if (unreconciled === undefined || !unreconciled.announced) return
      unreconciledSnapshotTurns.delete(turn.messageId)
      if (persistedParts === undefined || threadId.value !== turn.threadId)
        return
      const index = messages.value.findIndex(
        (message) => message.id === unreconciled.messageId
      )
      if (index < 0) return
      const reconciled = { ...messages.value[index] }
      if (unreconciled.missedFrom === 'reconnect')
        finishReconnectedTurn(reconciled, persistedParts)
      else finishSnapshotTurn(reconciled, persistedParts)
      messages.value[index] = reconciled
      syncKnownTurnMessage(turn.threadId, turn.messageId, reconciled)
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
        entry.transport.ingest(event)
        entry.transport.settle()
        syncKnownTurnMessage(entry.threadId, entry.messageId, entry.message)
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

    function recordPendingSendCanvasEvidence(
      evidence: CanvasSyncEvidence
    ): void {
      for (const send of pendingSends.values()) {
        if (
          send.status !== 'sending' ||
          send.canvasOutcomeAtStart === undefined
        )
          continue
        send.canvasEvidence ??= []
        if (send.canvasEvidence.length >= 256) send.canvasEvidence.shift()
        send.canvasEvidence.push(evidence)
      }
    }

    function notifyCanvasCaughtUp(evidence?: CanvasSyncEvidence): void {
      if (evidence !== undefined) recordPendingSendCanvasEvidence(evidence)
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
      syncKnownTurnMessage(slot.threadId, slot.turnId, slot.message)
      clearActive()
    }

    function stashActiveTurn(): void {
      const slot = activeSlot.value
      if (!slot) return
      if (slot.threadId === null) {
        abortActiveTurn()
        return
      }
      syncKnownTurnMessage(slot.threadId, slot.turnId, slot.message)
      backgroundTurns.set(slot.turnId, {
        threadId: slot.threadId,
        messageId: slot.turnId,
        message: slot.message,
        transport: slot.transport,
        userText: userTexts.value.get(slot.message.id),
        attachments: userAttachments.value.get(slot.message.id),
        tags: userTags.value.get(slot.message.id),
        workflowReferences: userWorkflowReferences.value.get(slot.message.id),
        skillReference: userSkillReferences.value.get(slot.message.id),
        settled: false,
        tab: slot.tab,
        pendingAskIds: pendingAskIdsOf(slot.message)
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
      const demotedSnapshotId = demotedSnapshotByStash.get(entry.messageId)
      const kept = messages.value.filter(
        (message) =>
          (message.id !== entry.message.id ||
            message.id === demotedSnapshotId) &&
          message.id !== unmatchedSnapshotId
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

    function retireBackgroundTurn(entry: BackgroundTurn): void {
      rememberDepartedTurn(entry.threadId, entry.messageId, 'settled-turn')
      entry.transport.dispose()
      revokeUnownedBlobPreviews(
        entry.attachments,
        collectOwnedBlobPreviews(true)
      )
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

    function setIfNonEmpty<T>(
      target: Map<TurnId, T[]>,
      id: TurnId,
      items: T[] | undefined
    ): void {
      if (items?.length) target.set(id, items)
    }

    function addBlobPreviews(
      attachments: readonly { previewUrl?: string }[] | undefined,
      target: Set<string>
    ): void {
      for (const { previewUrl } of attachments ?? []) {
        if (previewUrl?.startsWith('blob:')) target.add(previewUrl)
      }
    }

    function collectOwnedBlobPreviews(
      includeUserAttachments: boolean
    ): Set<string> {
      const owned = new Set<string>()
      if (includeUserAttachments) {
        for (const attachments of userAttachments.value.values())
          addBlobPreviews(attachments, owned)
      }
      for (const send of pendingSends.values()) {
        addBlobPreviews(send.attachments, owned)
        addBlobPreviews(send.sentAttachments, owned)
      }
      for (const entry of backgroundTurns.values())
        addBlobPreviews(entry.attachments, owned)
      for (const known of knownChats.values())
        for (const turn of known.localTurns)
          addBlobPreviews(turn.attachments, owned)
      return owned
    }

    function revokeUnownedBlobPreviews(
      attachments: readonly { previewUrl?: string }[] | undefined,
      owned: ReadonlySet<string>
    ): void {
      for (const { previewUrl } of attachments ?? []) {
        if (previewUrl?.startsWith('blob:') && !owned.has(previewUrl))
          URL.revokeObjectURL(previewUrl)
      }
    }

    function restoreBackgroundUserText(entry: BackgroundTurn): void {
      const id = entry.message.id
      if (entry.userText === undefined) {
        revokeUnownedBlobPreviews(
          entry.attachments,
          collectOwnedBlobPreviews(true)
        )
        return
      }
      if (!userTexts.value.has(id)) userTexts.value.set(id, entry.userText)
      if (!userAttachments.value.has(id))
        setIfNonEmpty(userAttachments.value, id, entry.attachments)
      else
        revokeUnownedBlobPreviews(
          entry.attachments,
          collectOwnedBlobPreviews(true)
        )
      if (!userTags.value.has(id)) setIfNonEmpty(userTags.value, id, entry.tags)
      if (!userWorkflowReferences.value.has(id))
        setIfNonEmpty(
          userWorkflowReferences.value,
          id,
          entry.workflowReferences
        )
      if (entry.skillReference && !userSkillReferences.value.has(id))
        userSkillReferences.value.set(id, entry.skillReference)
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
        entry.transport.dispose()
        syncKnownTurnMessage(entry.threadId, entry.messageId, entry.message)
        backgroundTurns.delete(entry.messageId)
        revokeUnownedBlobPreviews(
          entry.attachments,
          collectOwnedBlobPreviews(true)
        )
        return entry.messageId
      }
      return null
    }

    function dropBackgroundTurns(): void {
      const discarded = Array.from(backgroundTurns.values())
      for (const entry of discarded) {
        rememberDepartedTurn(
          entry.threadId,
          entry.messageId,
          entry.settled ? 'settled-turn' : 'no-live-turn'
        )
        entry.transport.settle()
        entry.transport.dispose()
      }
      backgroundTurns.clear()
      const owned = collectOwnedBlobPreviews(true)
      for (const entry of discarded)
        revokeUnownedBlobPreviews(entry.attachments, owned)
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
        finishActiveTurn(
          slot,
          persistedParts,
          missedFrameTurnIds.has(slot.turnId)
        )
        rememberDepartedActiveTurn('settled-turn')
        slot.transport.settle()
        slot.transport.dispose()
        syncKnownTurnMessage(turn.threadId, turn.messageId, slot.message)
        clearActive()
        finalizeSettledTurn(turn.threadId, slot.tab, ending)
        return
      }
      const entry = backgroundTurns.get(turn.messageId)
      if (!entry || entry.messageId !== turn.messageId || entry.settled) return
      finishWithPersistedParts(entry.message, persistedParts)
      entry.transport.settle()
      syncKnownTurnMessage(turn.threadId, turn.messageId, entry.message)
      updateBackgroundTurn(entry.messageId, { settled: true })
      finalizeSettledTurn(turn.threadId, entry.tab, ending)
    }

    function finalizeSettledTurn(
      turnThreadId: string,
      tab: TurnTab,
      ending: 'completed' | 'failed'
    ): void {
      if (!threadHasLiveTurn(turnThreadId)) clearSettledAskState(turnThreadId)
      if (ending === 'completed') announceCompletion(tab)
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

    /**
     * The mutable message a live turn is written into, not the snapshot copy
     * in `messages`: transports emit snapshots, so only this object carries
     * parts applied since the last emit.
     */
    function liveTurnMessage(turn: LiveTurn): AssistantMessage | null {
      const slot = activeSlot.value
      if (
        slot !== null &&
        turn.threadId === slot.threadId &&
        turn.messageId === slot.turnId
      )
        return slot.message
      const entry = backgroundTurns.get(turn.messageId)
      if (
        !entry ||
        entry.threadId !== turn.threadId ||
        entry.messageId !== turn.messageId ||
        entry.settled
      )
        return null
      return entry.message
    }

    function liveTurnMessageId(turn: LiveTurn): string | null {
      return liveTurnMessage(turn)?.id ?? null
    }

    function reconcileApprovalParts(
      turn: LiveTurn,
      pendingAskId?: string,
      protectedAskIds: ReadonlySet<string> = new Set()
    ): string[] {
      const message = liveTurnMessage(turn)
      if (message === null) return []
      const stale = message.parts.flatMap((part) => {
        if (!isOpenAskPart(part)) return []
        const askId = askIdOf(part)
        return askId !== undefined &&
          (pendingAskId === undefined || askId !== pendingAskId) &&
          !protectedAskIds.has(askId) &&
          submittedAskAnswer(askId) === undefined &&
          !answeringAskIds.value.has(askId)
          ? [askId]
          : []
      })
      for (const askId of stale)
        retireAsk(askId, { status: 'retired' }, turn.threadId, false)
      return stale
    }

    /**
     * Whether this turn is already showing `askId`. Turn recovery asks before
     * re-delivering an ask off a persisted row: the card a hydrate drew is on
     * screen without the session's ask ledger ever having seen a frame for
     * it, and only this catches that one. Reads the mutable message, so it
     * answers for the current moment and takes no reactive dependency.
     */
    function isApprovalShown(turn: LiveTurn, askId: string): boolean {
      const message = liveTurnMessage(turn)
      return (
        message?.parts.some(
          (part) => part.type === 'runApproval' && part.askId === askId
        ) ?? false
      )
    }

    function isAskShown(turn: LiveTurn, askId: string): boolean {
      return (
        liveTurnMessage(turn)?.parts.some(
          (part) => isOpenAskPart(part) && askIdOf(part) === askId
        ) ?? false
      )
    }

    function hasApprovalShown(turn: LiveTurn): boolean {
      return (
        liveTurnMessage(turn)?.parts.some((part) => isOpenAskPart(part)) ??
        false
      )
    }

    function clearActive(): void {
      activeSlot.value = null
      missedFrameTurnIds.clear()
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

    function revokeDetachedPreviews(turns: readonly KnownTurnSnapshot[]): void {
      const dropped = new Set<string>()
      for (const turn of turns) addBlobPreviews(turn.attachments, dropped)
      if (dropped.size === 0) return
      const owned = collectOwnedBlobPreviews(true)
      for (const url of dropped) if (!owned.has(url)) URL.revokeObjectURL(url)
    }

    function dropAttachmentPreviews(): void {
      const owned = collectOwnedBlobPreviews(false)
      for (const attachments of userAttachments.value.values())
        revokeUnownedBlobPreviews(attachments, owned)
      userAttachments.value = new Map()
    }

    function reset(blankChatId?: string): void {
      unreconciledSnapshotTurns.clear()
      disposeActiveAndSettledTransports()
      discardDetachedAskState()
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
      activeBlankChatId.value = blankChatId ?? nextBlankChatId()
      threadId.value = null
      hasAssignedBlankTab = true
      forgetAllApprovals()
      hydratedMessageIds = new Set()
      hydratedTurnIds = new Map()
      hydratedAssistantTurnIds = new Set()
      demotedSnapshotByStash.clear()
      restoredBackgroundMessageIds.clear()
      reportedPaywallImpressions.clear()
      undeliverableAskReporter.reset()
      departedTurns.clear()
      displayedTurnServerIds.clear()
      clearActive()
    }

    function reapplyRetiredAsks(
      transcript: ReturnType<typeof normalizeAgentTranscript>
    ): void {
      const retired = retiredAsksFor()
      const provisional = provisionalRetiredAsksFor()
      for (const message of transcript.messages)
        for (const [askId, resolution] of retired)
          message.parts = retireAskParts(message.parts, askId, resolution)
      for (const message of transcript.messages)
        for (const askId of provisional)
          message.parts = retireAskParts(message.parts, askId, {
            status: 'retired'
          })
    }

    function extractHydratedUserTurns(
      transcript: NormalizedAgentTranscript
    ): HydratedUserTurn[] {
      const userTurns: HydratedUserTurn[] = []
      for (const [turnId, text] of transcript.userTexts) {
        userTurns.push({
          turnId,
          text,
          skillName: transcript.userSkillReferences.get(turnId)?.name,
          attachmentCount: transcript.userAttachments.get(turnId)?.length ?? 0
        })
      }
      return userTurns
    }

    function findMatchingPersistedTurnId(
      send: PendingSend,
      userTurns: readonly HydratedUserTurn[],
      claimedTurns: ReadonlySet<string>
    ): string | undefined {
      const known = send.knownTurnIdsAtSend
      if (known === undefined) return undefined
      const expected = {
        text: send.text,
        skillName: send.skillReference?.name,
        workflowReferences: send.workflowReferences,
        attachmentCount: send.attachments.length
      }
      for (const turn of userTurns) {
        if (claimedTurns.has(turn.turnId) || known.has(turn.turnId)) continue
        if (matchesHydratedUserTurn(expected, turn)) return turn.turnId
      }
      return undefined
    }

    function isUncertainFailedThreadSend(
      send: PendingSend,
      activeThreadId: string
    ): boolean {
      return (
        send.status === 'failed' &&
        send.failure?.uncertain === true &&
        send.origin.kind === 'thread' &&
        send.origin.threadId === activeThreadId
      )
    }

    function reconcileFailedPendingSendsWithTranscript(
      activeThreadId: string,
      userTurns: readonly HydratedUserTurn[]
    ): void {
      const claimedTurns = new Set<string>()
      const reconciledIds: string[] = []
      for (const [id, send] of pendingSends) {
        if (!isUncertainFailedThreadSend(send, activeThreadId)) continue
        const matchedTurnId = findMatchingPersistedTurnId(
          send,
          userTurns,
          claimedTurns
        )
        if (matchedTurnId === undefined) continue
        claimedTurns.add(matchedTurnId)
        pendingSends.delete(id)
        reconciledIds.push(id)
      }
      if (reconciledIds.length > 0)
        void pendingSendsReconciled.trigger(reconciledIds)
    }

    function restoreReportedCredits(
      history: AgentMessages,
      restored: readonly AssistantMessage[]
    ): void {
      if (reportedTurnCredits.size === 0) return
      const byTurnId = new Map(
        restored.map((message) => [message.id as string, message])
      )
      for (const row of history) {
        if (row.role !== 'assistant') continue
        const credits = reportedTurnCredits.get(toTurnId(row.id))
        if (credits === undefined) continue
        const message = byTurnId.get(row.turn_id)
        if (message !== undefined && message.creditsUsed === undefined)
          message.creditsUsed = credits
      }
    }

    function hydrate(
      history: AgentMessages,
      options?: { skipSnapshotTurns?: ReadonlySet<TurnId> }
    ): void {
      const replacedSlot = activeSlot.value
      if (replacedSlot) rememberDepartedActiveTurn('no-live-turn')
      unreconciledSnapshotTurns.clear()
      displayedTurnServerIds.clear()
      disposeActiveAndSettledTransports()
      clearActive()
      const transcript = normalizeAgentTranscript(
        history,
        (askId) =>
          isAskRetired(askId) ||
          submittedAskAnswer(askId) !== undefined ||
          answeringAskIds.value.has(askId),
        (askId) => isAskRetired(askId)
      )
      reapplyRetiredAsks(transcript)
      restoreReportedCredits(history, transcript.messages)
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
      if (threadId.value !== null) {
        const userTurns = extractHydratedUserTurns(transcript)
        reconcileFailedPendingSendsWithTranscript(threadId.value, userTurns)
        void transcriptHydrated.trigger({
          threadId: threadId.value,
          userTurns
        })
      }
      const pending = unstashedLiveTurn(transcript)
      if (pending && options?.skipSnapshotTurns?.has(pending.messageId)) {
        settleLiveMessage(pending.message)
      } else if (pending) {
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
            replacedSlot !== null && replacedSlot.turnId === pending.messageId
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

    function pendingSendEntry(send: PendingSend): UserEntry {
      return {
        id: toTurnId(send.clientMessageId),
        role: 'user',
        text: send.text,
        attachments: send.attachments,
        tags: send.tags,
        workflowReferences: send.workflowReferences,
        ...(send.skillReference ? { skillReference: send.skillReference } : {}),
        pending: {
          clientMessageId: send.clientMessageId,
          status: send.status,
          failure: send.failure,
          ...(send.failure?.kind === 'paywall'
            ? {
                paywallResolved: send.paywallResolved === true
              }
            : {})
        }
      }
    }

    const entries = computed<ConversationEntry[]>(() => {
      const pending = pendingSendsForCurrentChat.value
      const preceding = pending.filter(
        ({ precedesThreadTranscript }) => precedesThreadTranscript === true
      )
      const trailing = pending.filter(
        ({ precedesThreadTranscript }) => precedesThreadTranscript !== true
      )
      return [
        ...preceding.map(pendingSendEntry),
        ...messages.value.flatMap((recordedMessage) => {
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
              role: 'user' as const,
              text,
              attachments: userAttachments.value.get(message.id),
              tags: userTags.value.get(message.id),
              workflowReferences: userWorkflowReferences.value.get(message.id),
              ...(skillReference ? { skillReference } : {})
            },
            ...assistantEntries
          ]
        }),
        ...trailing.map(pendingSendEntry)
      ]
    })

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

    function askKind(
      askId: string
    ): 'runApproval' | 'askUser' | 'deleteApproval' | undefined {
      for (const message of messages.value) {
        const part = message.parts.find(
          (candidate) =>
            isPendingAskPart(candidate) && candidate.askId === askId
        )
        if (
          part?.type === 'runApproval' ||
          part?.type === 'askUser' ||
          part?.type === 'deleteApproval'
        )
          return part.type
      }
    }

    const activeMessageId = computed(() => activeMessage.value?.id ?? null)
    const isStreaming = computed(() => activeMessage.value?.streaming ?? false)

    function awaitsAnswer(pendingAskIds: readonly string[]): boolean {
      return pendingAskIds.some((askId) => !answeringAskIds.value.has(askId))
    }

    const activeTurnTabPath = computed(() => {
      const slot = activeSlot.value
      return slot !== null && isStreaming.value ? openPathOf(slot.tab) : null
    })
    const activeTurnAwaitsAnswer = computed(() =>
      activeMessage.value
        ? awaitsAnswer(pendingAskIdsOf(activeMessage.value))
        : false
    )
    const awaitingApproval = computed(
      () =>
        (isStreaming.value && activeTurnAwaitsAnswer.value) ||
        [...backgroundTurns.values()].some(
          ({ settled, pendingAskIds }) =>
            !settled && awaitsAnswer(pendingAskIds)
        )
    )
    const pendingAskIds = computed<readonly string[]>(() => [
      ...(isStreaming.value && activeMessage.value
        ? pendingAskIdsOf(activeMessage.value)
        : []),
      ...[...backgroundTurns.values()].flatMap(({ settled, pendingAskIds }) =>
        settled ? [] : pendingAskIds
      )
    ])
    const turnTabs = computed<AgentTurnTab[]>(() => {
      const activePath = activeTurnTabPath.value
      const background = [...backgroundTurns.values()].flatMap(
        ({ settled, tab, pendingAskIds }) => {
          const path = settled ? null : openPathOf(tab)
          return path === null
            ? []
            : [{ path, awaitingApproval: awaitsAnswer(pendingAskIds) }]
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
    const knownChats = new Map<string, KnownChatState>()

    function threadHasLiveTurn(id: string): boolean {
      if (activeSlot.value?.threadId === id) return true
      for (const entry of backgroundTurns.values()) {
        if (entry.threadId === id && !entry.settled) return true
      }
      return false
    }

    function evictKnownChatEntries(
      protectedId: string,
      includeLive: boolean,
      evicted: KnownTurnSnapshot[]
    ): void {
      for (const [oldest, oldestState] of knownChats) {
        if (knownChats.size <= KEPT_KNOWN_CHATS) break
        if (oldest === protectedId) continue
        if (!includeLive && threadHasLiveTurn(oldest)) continue
        knownChats.delete(oldest)
        evicted.push(...oldestState.localTurns)
      }
    }

    function touchKnownChatEntry(id: string, state: KnownChatState): void {
      knownChats.delete(id)
      knownChats.set(id, state)
      const evicted: KnownTurnSnapshot[] = []
      evictKnownChatEntries(id, false, evicted)
      evictKnownChatEntries(id, true, evicted)
      if (evicted.length > 0) revokeDetachedPreviews(evicted)
    }

    function liveOrInitialTurnMessage(turnId: TurnId): AssistantMessage {
      if (activeSlot.value?.turnId === turnId) return activeSlot.value.message
      return (
        backgroundTurns.get(turnId)?.message ?? createAssistantMessage(turnId)
      )
    }

    function upsertLocalTurn(
      known: KnownChatState,
      turn: KnownTurnSnapshot
    ): KnownTurnSnapshot | undefined {
      const index = known.localTurns.findIndex(
        (existing) => existing.turnId === turn.turnId
      )
      if (index === -1) {
        known.localTurns.push(turn)
        return undefined
      }
      const replaced = known.localTurns[index]
      known.localTurns[index] = turn
      return replaced
    }

    function recordAcceptedTurn(input: {
      threadId: string
      turnId: TurnId
      clientMessageId?: string
      createdHere: boolean
      workflowId?: string
      text: string
      attachments?: UserAttachment[]
      tags?: string[]
      workflowReferences?: WorkflowReference[]
    }): void {
      let known = knownChats.get(input.threadId)
      if (!known && !input.createdHere) return
      known ??= {
        createdHere: true,
        fetchedFromServer: false,
        version: 0,
        baseHistory: [],
        latestWorkflowId: input.workflowId,
        localTurns: []
      }
      known.version += 1
      if (input.workflowId !== undefined)
        known.latestWorkflowId = input.workflowId
      const prompt = parseSkillReferenceText(
        input.text,
        input.workflowReferences
      )
      const replaced = upsertLocalTurn(known, {
        turnId: input.turnId,
        clientMessageId: input.clientMessageId,
        userText: prompt.text,
        attachments: input.attachments,
        tags: input.tags,
        workflowReferences: input.workflowReferences?.length
          ? prompt.workflowReferences
          : undefined,
        skillReference: prompt.skillReference,
        message: snapshotMessage(liveOrInitialTurnMessage(input.turnId))
      })
      touchKnownChatEntry(input.threadId, known)
      if (replaced) revokeDetachedPreviews([replaced])
    }

    function syncKnownTurnMessage(
      turnThreadId: string | null,
      turnId: TurnId,
      message: AssistantMessage
    ): void {
      if (!turnThreadId) return
      const local = knownChats
        .get(turnThreadId)
        ?.localTurns.find((turn) => turn.turnId === turnId)
      if (local) local.message = snapshotMessage(message)
    }

    function bumpKnownChatVersion(id: string): void {
      const known = knownChats.get(id)
      if (known) known.version += 1
    }

    function knownChatVersion(id: string): number {
      return knownChats.get(id)?.version ?? 0
    }

    function isKnownChat(id: string): boolean {
      return knownChats.has(id)
    }

    function hasKnownLocalTurn(id: string, turnId: TurnId): boolean {
      return (
        knownChats.get(id)?.localTurns.some((turn) => turn.turnId === turnId) ??
        false
      )
    }

    function isKnownChatSettledFromServer(id: string): boolean {
      const known = knownChats.get(id)
      return (
        known !== undefined &&
        known.fetchedFromServer &&
        known.localTurns.length === 0
      )
    }

    function normalizedMessageCopy(
      message: AssistantMessage,
      turnId: TurnId,
      settle: boolean
    ): AssistantMessage {
      const copy = settle ? settledCopyOf(message) : snapshotMessage(message)
      copy.id = turnId
      return copy
    }

    function liveTurnsAsLocalSnapshots(id: string): KnownTurnSnapshot[] {
      const snapshots: KnownTurnSnapshot[] = []
      const seen = new Set<TurnId>()
      const slot = activeSlot.value
      if (slot?.threadId === id && slot.origin !== 'snapshot') {
        seen.add(slot.turnId)
        const displayId = slot.message.id
        snapshots.push({
          turnId: slot.turnId,
          userText:
            userTexts.value.get(displayId) ?? userTexts.value.get(slot.turnId),
          attachments:
            userAttachments.value.get(displayId) ??
            userAttachments.value.get(slot.turnId),
          tags:
            userTags.value.get(displayId) ?? userTags.value.get(slot.turnId),
          workflowReferences:
            userWorkflowReferences.value.get(displayId) ??
            userWorkflowReferences.value.get(slot.turnId),
          skillReference:
            userSkillReferences.value.get(displayId) ??
            userSkillReferences.value.get(slot.turnId),
          message: normalizedMessageCopy(slot.message, slot.turnId, false)
        })
      }
      for (const entry of backgroundTurns.values()) {
        if (entry.threadId !== id || seen.has(entry.messageId)) continue
        seen.add(entry.messageId)
        snapshots.push({
          turnId: entry.messageId,
          userText: entry.userText,
          attachments: entry.attachments,
          tags: entry.tags,
          workflowReferences: entry.workflowReferences,
          skillReference: entry.skillReference,
          message: normalizedMessageCopy(entry.message, entry.messageId, false)
        })
      }
      return snapshots
    }

    function expandSendKnownTurnIds(
      send: PendingSend,
      serverTurnToLocal: ReadonlyMap<string, TurnId>
    ): void {
      const known = send.knownTurnIdsAtSend
      if (known === undefined) return
      let expanded: Set<string> | undefined
      for (const [serverTurnId, localTurnId] of serverTurnToLocal) {
        if (known.has(localTurnId) && !known.has(serverTurnId)) {
          expanded ??= new Set(known)
          expanded.add(serverTurnId)
        }
      }
      if (expanded !== undefined) send.knownTurnIdsAtSend = expanded
    }

    function aliasKnownPendingSendTurns(
      id: string,
      serverTurnToLocal: ReadonlyMap<string, TurnId>
    ): void {
      if (serverTurnToLocal.size === 0) return
      for (const send of pendingSends.values()) {
        if (send.origin.kind === 'thread' && send.origin.threadId === id)
          expandSendKnownTurnIds(send, serverTurnToLocal)
      }
    }

    function nextHydratedKnownEntry(
      existing: KnownChatState | undefined,
      candidateLocalTurns: readonly KnownTurnSnapshot[],
      history: AgentMessages,
      settledServerTurns: ReadonlySet<TurnId>,
      workflowId?: string
    ): { entry: KnownChatState; dropped: KnownTurnSnapshot[] } {
      const resolvedWorkflow = workflowId ?? latestWorkflowIdOf(history)
      const nextLocal = pruneSettledLocalTurns(
        candidateLocalTurns,
        settledServerTurns
      )
      if (!existing) {
        return {
          entry: {
            createdHere: false,
            fetchedFromServer: true,
            version: 1,
            baseHistory: history,
            latestWorkflowId: resolvedWorkflow,
            localTurns: nextLocal
          },
          dropped: []
        }
      }
      return {
        entry: {
          createdHere: existing.createdHere,
          fetchedFromServer: true,
          version: existing.version + 1,
          baseHistory: history,
          latestWorkflowId: resolvedWorkflow ?? existing.latestWorkflowId,
          localTurns: nextLocal
        },
        dropped: existing.localTurns.filter((turn) => !nextLocal.includes(turn))
      }
    }

    function recordHydratedChat(
      id: string,
      history: AgentMessages,
      workflowId?: string
    ): void {
      const existing = knownChats.get(id)
      const candidateLocalTurns = existing
        ? existing.localTurns
        : liveTurnsAsLocalSnapshots(id)
      const alignment = alignKnownChatHistory(
        history,
        existing ? existing.baseHistory : [],
        candidateLocalTurns
      )
      if (alignment.status !== 'aligned') {
        invalidateKnownChat(id)
        return
      }
      aliasKnownPendingSendTurns(id, alignment.serverTurnToLocal)
      const { entry, dropped } = nextHydratedKnownEntry(
        existing,
        candidateLocalTurns,
        history,
        alignment.settledServerTurns,
        workflowId
      )
      touchKnownChatEntry(id, entry)
      if (dropped.length > 0) revokeDetachedPreviews(dropped)
    }

    function recallKnownChat(id: string) {
      const known = knownChats.get(id)
      if (!known) return undefined
      touchKnownChatEntry(id, known)
      return {
        version: known.version,
        createdHere: known.createdHere,
        hasLocalTurns: known.localTurns.length > 0,
        hasBaseHistory: known.fetchedFromServer,
        latestWorkflowId: known.latestWorkflowId
      }
    }

    function invalidateKnownChat(id: string): void {
      const removed = knownChats.get(id)
      if (!removed) return
      knownChats.delete(id)
      if (removed.localTurns.length > 0)
        revokeDetachedPreviews(removed.localTurns)
    }

    function invalidateAllKnownChats(): void {
      const dropped = [...knownChats.values()].flatMap(
        (known) => known.localTurns
      )
      knownChats.clear()
      if (dropped.length > 0) revokeDetachedPreviews(dropped)
    }

    function setIfMissing<K, V>(
      map: Map<K, V>,
      key: K,
      value: V | undefined
    ): void {
      if (value !== undefined && !map.has(key)) map.set(key, value)
    }

    function retireSettledBackgroundTurn(id: string, turnId: TurnId): void {
      const bg = backgroundTurns.get(turnId)
      if (!bg || bg.threadId !== id) return
      backgroundTurns.delete(bg.messageId)
      bg.transport.settle()
      retireBackgroundTurn(bg)
      if (!threadHasLiveTurn(id)) clearSettledAskState(id)
    }

    interface SettledServerLiveTurn {
      turn: LiveTurn
      persistedParts: AssistantMessage['parts'] | undefined
      ending: 'completed' | 'failed'
    }

    function serverEndingOf(
      aligned: AgentMessages,
      turnId: TurnId
    ): 'completed' | 'failed' {
      const last = aligned
        .filter((row) => row.role === 'assistant' && row.turn_id === turnId)
        .sort((a, b) => a.seq - b.seq)
        .at(-1)
      return last?.status === 'complete' ? 'completed' : 'failed'
    }

    function setListIfMissing<T>(
      map: Map<TurnId, T[]>,
      key: TurnId,
      items: T[] | undefined
    ): void {
      if (items && items.length > 0 && !map.has(key)) map.set(key, items)
    }

    function restoreLocalTurnSkill(localTurn: KnownTurnSnapshot): void {
      const skill = localTurn.skillReference
      if (!skill || userSkillReferences.value.has(localTurn.turnId)) return
      userSkillReferences.value.set(localTurn.turnId, skill)
      if (!historySkillNames.value.includes(skill.name))
        historySkillNames.value = [...historySkillNames.value, skill.name]
    }

    function restoreLocalTurnUserMetadata(localTurn: KnownTurnSnapshot): void {
      setIfMissing(userTexts.value, localTurn.turnId, localTurn.userText)
      setListIfMissing(
        userAttachments.value,
        localTurn.turnId,
        localTurn.attachments
      )
      if (localTurn.tags && localTurn.tags.length > 0)
        userTags.value.set(localTurn.turnId, localTurn.tags)
      setListIfMissing(
        userWorkflowReferences.value,
        localTurn.turnId,
        localTurn.workflowReferences
      )
      restoreLocalTurnSkill(localTurn)
    }

    function collectSettledOverlayTurn(
      id: string,
      localTurn: KnownTurnSnapshot,
      bg: BackgroundTurn | undefined,
      srvIdx: number,
      updatedMessages: AssistantMessage[],
      aligned: AgentMessages,
      settledLiveTurns: SettledServerLiveTurn[]
    ): void {
      if (bg && !bg.settled) {
        settledLiveTurns.push({
          turn: { threadId: id, messageId: localTurn.turnId },
          persistedParts:
            srvIdx !== -1 ? updatedMessages[srvIdx].parts : undefined,
          ending: serverEndingOf(aligned, localTurn.turnId)
        })
      } else if (bg) {
        retireSettledBackgroundTurn(id, bg.messageId)
      }
    }

    function takeOverlayMessage(
      localTurn: KnownTurnSnapshot,
      bg: BackgroundTurn | undefined
    ): { message: AssistantMessage; resume?: BackgroundTurn } {
      if (bg && !bg.settled) {
        bg.message.id = localTurn.turnId
        return { message: bg.message, resume: bg }
      }
      if (bg?.settled) {
        backgroundTurns.delete(bg.messageId)
        retireBackgroundTurn(bg)
        return {
          message: normalizedMessageCopy(bg.message, localTurn.turnId, true)
        }
      }
      return {
        message: normalizedMessageCopy(
          localTurn.message,
          localTurn.turnId,
          true
        )
      }
    }

    function applyOverlayTurn(
      id: string,
      localTurn: KnownTurnSnapshot,
      updatedMessages: AssistantMessage[],
      aligned: AgentMessages,
      settledServerTurns: ReadonlySet<TurnId>,
      settledLiveTurns: SettledServerLiveTurn[],
      nextLocal: KnownTurnSnapshot[]
    ): { entry: BackgroundTurn; index: number } | undefined {
      const srvIdx = updatedMessages.findIndex(
        (msg) => msg.id === localTurn.turnId
      )
      const bgRaw = backgroundTurns.get(localTurn.turnId)
      const bg = bgRaw?.threadId === id ? bgRaw : undefined

      if (settledServerTurns.has(localTurn.turnId)) {
        collectSettledOverlayTurn(
          id,
          localTurn,
          bg,
          srvIdx,
          updatedMessages,
          aligned,
          settledLiveTurns
        )
        return undefined
      }

      const display = takeOverlayMessage(localTurn, bg)
      const screenMessage = display.resume
        ? snapshotMessage(display.message)
        : display.message
      const idx =
        srvIdx !== -1
          ? ((updatedMessages[srvIdx] = screenMessage), srvIdx)
          : updatedMessages.push(screenMessage) - 1
      restoreLocalTurnUserMetadata(localTurn)
      nextLocal.push({
        ...localTurn,
        message: snapshotMessage(display.message)
      })
      return display.resume ? { entry: display.resume, index: idx } : undefined
    }

    function overlayLocalTurnsOnScreen(
      id: string,
      known: KnownChatState,
      aligned: AgentMessages,
      settledServerTurns: ReadonlySet<TurnId>
    ): {
      nextLocal: KnownTurnSnapshot[]
      settledLiveTurns: SettledServerLiveTurn[]
    } {
      const nextLocal: KnownTurnSnapshot[] = []
      const settledLiveTurns: SettledServerLiveTurn[] = []
      let resumed: { entry: BackgroundTurn; index: number } | undefined
      const updatedMessages = [...messages.value]

      for (const localTurn of known.localTurns) {
        const candidate = applyOverlayTurn(
          id,
          localTurn,
          updatedMessages,
          aligned,
          settledServerTurns,
          settledLiveTurns,
          nextLocal
        )
        if (candidate) resumed = candidate
      }

      messages.value = updatedMessages
      if (resumed) {
        backgroundTurns.delete(resumed.entry.messageId)
        claimSlotForBackgroundTurn(resumed.entry, resumed.index, id)
      } else if (activeSlot.value === null && threadHasLiveTurn(id))
        resumeBackgroundTurn()
      return { nextLocal, settledLiveTurns }
    }

    function collectOffScreenSettledTurns(
      id: string,
      aligned: AgentMessages,
      settledServerTurns: ReadonlySet<TurnId>
    ): SettledServerLiveTurn[] {
      const settledLiveTurns: SettledServerLiveTurn[] = []
      for (const bg of backgroundTurns.values()) {
        if (bg.threadId !== id || !settledServerTurns.has(bg.messageId))
          continue
        if (!bg.settled) {
          const parsed = normalizeAgentTranscript(
            aligned.filter((row) => row.turn_id === bg.messageId)
          )
          settledLiveTurns.push({
            turn: { threadId: id, messageId: bg.messageId },
            persistedParts: parsed.messages[0]?.parts,
            ending: serverEndingOf(aligned, bg.messageId)
          })
        } else {
          retireSettledBackgroundTurn(id, bg.messageId)
        }
      }
      return settledLiveTurns
    }

    function skipSnapshotTurnsOf(
      id: string,
      localTurns: readonly KnownTurnSnapshot[]
    ): Set<TurnId> {
      const skip = new Set<TurnId>()
      for (const turn of localTurns) {
        const bg = backgroundTurns.get(turn.turnId)
        if (!(bg?.threadId === id && !bg.settled)) skip.add(turn.turnId)
      }
      return skip
    }

    function applyKnownChatOnScreen(
      id: string,
      known: KnownChatState,
      aligned: AgentMessages,
      serverHistory: AgentMessages,
      settledServerTurns: ReadonlySet<TurnId>,
      serverTurnToLocal: ReadonlyMap<string, TurnId>,
      skipIfUnchanged: boolean
    ): {
      nextLocal: KnownTurnSnapshot[]
      settledLiveTurns: SettledServerLiveTurn[]
      unchanged?: true
    } {
      if (
        skipIfUnchanged &&
        known.localTurns.length === 0 &&
        isEqual(known.baseHistory, serverHistory)
      ) {
        latestWorkflowId.value ??= known.latestWorkflowId
        return {
          nextLocal: known.localTurns,
          settledLiveTurns: [],
          unchanged: true
        }
      }

      if (activeSlot.value?.threadId === id) stashActiveTurn()
      hydrate(aligned, {
        skipSnapshotTurns: skipSnapshotTurnsOf(id, known.localTurns)
      })
      recordDisplayedTurnAliases(serverTurnToLocal)
      latestWorkflowId.value ??= known.latestWorkflowId
      known.latestWorkflowId = latestWorkflowId.value ?? known.latestWorkflowId
      return overlayLocalTurnsOnScreen(id, known, aligned, settledServerTurns)
    }

    function applyKnownChatState(
      id: string,
      serverHistory: AgentMessages,
      onScreen: boolean,
      skipIfUnchanged = false
    ):
      | { status: 'applied'; settledLiveTurns: SettledServerLiveTurn[] }
      | { status: 'ambiguous' | 'unowned-streaming' | 'missing' } {
      const known = knownChats.get(id)
      if (!known) return { status: 'missing' }
      const alignment = alignKnownChatHistory(
        serverHistory,
        known.baseHistory,
        known.localTurns
      )
      if (alignment.status !== 'aligned') {
        invalidateKnownChat(id)
        return { status: alignment.status }
      }

      const {
        history: aligned,
        settledServerTurns,
        serverTurnToLocal
      } = alignment
      aliasKnownPendingSendTurns(id, serverTurnToLocal)
      const dropped = known.localTurns.filter((turn) =>
        settledServerTurns.has(turn.turnId)
      )

      let nextLocal: KnownTurnSnapshot[]
      let settledLiveTurns: SettledServerLiveTurn[]
      if (!onScreen || threadId.value !== id) {
        settledLiveTurns = collectOffScreenSettledTurns(
          id,
          aligned,
          settledServerTurns
        )
        nextLocal = pruneSettledLocalTurns(known.localTurns, settledServerTurns)
        known.latestWorkflowId =
          latestWorkflowIdOf(serverHistory) ?? known.latestWorkflowId
      } else {
        const applied = applyKnownChatOnScreen(
          id,
          known,
          aligned,
          serverHistory,
          settledServerTurns,
          serverTurnToLocal,
          skipIfUnchanged
        )
        if (applied.unchanged)
          return { status: 'applied', settledLiveTurns: [] }
        nextLocal = applied.nextLocal
        settledLiveTurns = applied.settledLiveTurns
      }

      known.baseHistory = serverHistory
      known.fetchedFromServer ||= skipIfUnchanged
      known.localTurns = nextLocal
      if (dropped.length > 0) revokeDetachedPreviews(dropped)
      return { status: 'applied', settledLiveTurns }
    }

    function hydrateKnownChat(id: string): boolean {
      const known = knownChats.get(id)
      if (!known) return false
      return (
        applyKnownChatState(id, known.baseHistory, true, false).status ===
        'applied'
      )
    }

    function reconcileKnownChat(
      id: string,
      fresh: AgentMessages,
      onScreen: boolean
    ) {
      return applyKnownChatState(id, fresh, onScreen, true)
    }

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
      awaitingApproval,
      pendingAskIds,
      onTurnCompleted: turnCompleted.on,
      onSnapshotTurnSettled: snapshotTurnSettled.on,
      onPendingSendsReconciled: pendingSendsReconciled.on,
      onTranscriptHydrated: transcriptHydrated.on,
      onBlankChatFailuresBound: blankChatFailuresBound.on,
      knownUserTurnIds,
      setTurnTabResolver,
      moveTurnToTab,
      adoptThreadTab,
      threadId,
      activeBlankChatId: computed(() => activeBlankChatId.value),
      adoptInitialBlankTab,
      blankChatIdForTab,
      advanceBlankChatIdForTab,
      setBlankChatIdForTab,
      tabKeyForBlankChat,
      currentOrigin,
      isOriginOnScreen,
      hasSendingPendingSend,
      hasSendingForOrigin,
      isOriginBusy,
      hasPendingSendForOrigin,
      discardFailedPendingSends,
      startPendingSend,
      capturePendingSendCanvasBaseline,
      failPendingSend,
      retryPendingSend,
      markPendingSendStopped,
      takePendingSend,
      bindCertainBlankChatFailures,
      getPendingSend,
      hasPendingSendForBlankChat,
      discardPendingSendsOutsideWorkspace,
      updatePendingAttachmentPreview,
      startBackgroundTurn,
      isStreaming,
      status,
      latestWorkflowId,
      recordApprovalShown,
      approvalShownAt,
      approvalTurnId,
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
      submittedAskAnswer,
      takeSubmittedAskAnswer,
      markAskAwaitingResolution,
      asksAwaitingResolution,
      clearAskAwaitingResolution,
      askKind,
      commitAsk,
      retireAsk,
      isAskRetired,
      isAskPermanentlyRetired,
      confirmAskPending,
      reconcileApprovalParts,
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
      liveTurnMessageId,
      turnUsesSkill,
      historySkillNames,
      settleTurn,
      reconcileSettledTurn,
      markActiveTurnMissedFrames,
      isApprovalShown,
      isAskShown,
      hasApprovalShown,
      reset,
      hydrate,
      recordAcceptedTurn,
      bumpKnownChatVersion,
      knownChatVersion,
      isKnownChat,
      hasKnownLocalTurn,
      isKnownChatSettledFromServer,
      recordHydratedChat,
      recallKnownChat,
      invalidateKnownChat,
      invalidateAllKnownChats,
      hydrateKnownChat,
      reconcileKnownChat,
      retireSettledBackgroundTurn
    }
  }
)
