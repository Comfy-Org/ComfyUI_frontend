import { delay } from 'es-toolkit'
import { computed, ref } from 'vue'

import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { createUuidv4 } from '@/utils/uuid'
import type {
  AgentActiveTabData,
  AgentMessages,
  AgentTurnAccepted,
  TurnId
} from '../../schemas/agentApiSchema'
import {
  isAgentEvent,
  parseAgentWsEvent,
  toTurnId,
  zAgentAdmissionError,
  zDisownedWorkflowError
} from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftSnapshot,
  OpenTabsSnapshot,
  PostMessageInput
} from '../../services/agent/agentRestClient'
import type { LiveTurn } from '../../stores/agent/agentConversationStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import type { WorkflowReference } from '../../types/workflowReference'
import { serializeWorkflowReferences } from '../../utils/workflowReferenceText'

export interface AgentEventSource {
  subscribe(listener: (raw: unknown) => void): () => void
  onStatus?(listener: (live: boolean) => void): () => void
}

interface SessionNotice {
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
  id?: string
  tabPath: string
}

/**
 * Workflow lookup context: omitted resolves the currently selected target,
 * `null` pins the absence of a target, and `{ tabPath }` pins its identity.
 * A send captures this before preparation so later selections cannot change
 * which workflow owns the turn.
 */
export type TurnOrigin = { tabPath: string } | null

type PromptEditState =
  | { phase: 'idle' }
  | { phase: 'stopping'; turnId: TurnId }
  | { phase: 'ready'; turnId: TurnId }

export interface AgentSessionDeps {
  rest: AgentRestClient
  events: AgentEventSource
  workflow?: {
    // origin, when given, pins resolution to the tab that initiated the send
    // instead of the target selected when this is called - it is read
    // after prepare() so cloud ids it resolves are fresh, but must still
    // describe the pre-await originating tab, not a later switch. See
    // TurnOrigin for why "no origin tab" is a value rather than an omission.
    current(origin?: TurnOrigin): WorkflowTurnContext | undefined
    adopted(workflowId: string, sent: WorkflowTurnContext | undefined): void
    restored?(
      workflowId: string | undefined,
      isCurrent: () => boolean
    ): Promise<void> | void
    prepare?(): Promise<void>
    /** The server refused this workflow id; forget every cached trace of it. */
    disowned?(workflowId: string): void
    tabs?(origin?: TurnOrigin): OpenTabsSnapshot | undefined
    activeTab?(data: AgentActiveTabData): void
    draft?(origin?: TurnOrigin): DraftSnapshot | undefined
  }
}

const THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'
const PREPARE_TIMEOUT_MS = 3000
/**
 * After a reconnect or a refresh the server may still be finishing the turn,
 * and its terminal event may never reach this socket (dropped during
 * hydration, or the row was orphaned and only a server sweep will end it).
 * Poll the persisted row with backoff, then keep checking at the last delay
 * for as long as the turn is still live here. Each request uses the REST
 * client's response-header timeout and remains abortable when the session
 * stops. The job ends when the row reports a terminal state or a missing
 * thread, when the turn leaves the conversation store's live set, or when the
 * session that started it stops or is superseded. It is open-ended only while
 * the server keeps answering with a streaming row: after
 * TURN_RECOVERY_MAX_CONSECUTIVE_FAILURES checks in a row that fail or find no
 * row for the turn it gives up. If the last check finds no row, it settles the
 * turn with the text it already has, since the server has nothing more to
 * deliver; if the last check fails, it leaves the turn live for the socket and
 * the next reconnect.
 * Switching threads stashes the turn rather than ending it, so its recovery
 * keeps running in the background.
 */
type RecoverySchedule = readonly [number, ...number[]]
const TURN_RECOVERY_DELAYS_AFTER_FETCH_MS: RecoverySchedule = [
  1000, 2000, 4000, 8000, 16000
]
const TURN_RECOVERY_DELAYS_MS: RecoverySchedule = [
  0,
  ...TURN_RECOVERY_DELAYS_AFTER_FETCH_MS
]
const TURN_RECOVERY_MAX_CONSECUTIVE_FAILURES = TURN_RECOVERY_DELAYS_MS.length
/** How long a restored ask waits for its own broadcast before it counts as lost. */
const LATE_ASK_FRAME_GRACE_MS = 2000

/**
 * Why a recovery job is running, which is what separates an ask the socket
 * genuinely dropped from one that merely had not been published when a
 * hydrate's history fetch went out. Only the former is a defect.
 */
type RecoveryCause = 'reconnect' | 'hydrate'

interface RecoveryPlan {
  delaysMs: RecoverySchedule
  cause: RecoveryCause
}

const RECONNECT_RECOVERY: RecoveryPlan = {
  delaysMs: TURN_RECOVERY_DELAYS_MS,
  cause: 'reconnect'
}
const HYDRATE_RECOVERY: RecoveryPlan = {
  delaysMs: TURN_RECOVERY_DELAYS_AFTER_FETCH_MS,
  cause: 'hydrate'
}

type PendingAsk = NonNullable<AgentMessages[number]['pending_ask']>

type TurnOutcome =
  | { kind: 'terminal'; text: string }
  | { kind: 'thread-missing' }
  | { kind: 'message-missing' }
  | { kind: 'streaming'; pendingAsk: PendingAsk | undefined }
  | { kind: 'error'; message: string }

/**
 * The status source reports its current state synchronously on subscribe
 * (see agentEventSource.onStatus), so the first callback is a snapshot, not a
 * transition. An initial `false` (still connecting) is therefore not a drop.
 */
type SocketConnection = 'initial' | 'live' | 'dropped'

function recoveryKey(turn: LiveTurn): string {
  return JSON.stringify([turn.threadId, turn.messageId])
}

function turnOutcomeFromError(error: unknown): TurnOutcome {
  if (error instanceof AgentApiError && error.status === 404)
    return { kind: 'thread-missing' }
  return {
    kind: 'error',
    message: error instanceof Error ? error.message : String(error)
  }
}

let sessionGeneration = 0

/**
 * Page-lifetime binding memory: the workflow a resumed turn belongs to must
 * survive a panel remount. Module-level like `sessionGeneration`;
 * newChat/loadThread clear it.
 */
let rememberedWorkflowId: string | null = null

function parseAdmissionError(error: unknown) {
  if (!(error instanceof AgentApiError)) return undefined
  const parsed = zAgentAdmissionError.safeParse(error.body)
  if (!parsed.success) return undefined
  const expectedStatus =
    parsed.data.error.type === 'PAYMENT_REQUIRED' ? 402 : 503
  if (error.status !== expectedStatus) return undefined
  return { ...parsed.data.error, retryAfterSeconds: error.retryAfterSeconds }
}

function disownsWorkflow(error: unknown): boolean {
  return (
    error instanceof AgentApiError &&
    error.status === 403 &&
    zDisownedWorkflowError.safeParse(error.body).success
  )
}

export function useAgentSession(deps: AgentSessionDeps) {
  const { rest, events, workflow } = deps

  const conversationStore = useAgentConversationStore()
  const bindingStore = useAgentWorkflowTabBindingStore()
  /**
   * The workflow the session is bound to (set on turn ack or an active-tab
   * switch, cleared by newChat/loadThread) - the CRDT follower's subscribe
   * target.
   */
  const boundWorkflowId = ref<string | null>(rememberedWorkflowId)

  const notices = ref<SessionNotice[]>([])
  const promptEditState = ref<PromptEditState>({ phase: 'idle' })
  const sending = ref(false)
  const answeringAskIds = ref<ReadonlySet<string>>(new Set())

  function setAskAnswering(askId: string, answering: boolean): void {
    const next = new Set(answeringAskIds.value)
    if (answering) next.add(askId)
    else next.delete(askId)
    answeringAskIds.value = next
  }

  function nextLocalErrorId(): TurnId {
    return toTurnId(`local-error-${createUuidv4()}`)
  }

  let unsubscribe: (() => void) | null = null
  let unsubscribeStatus: (() => void) | null = null
  let ownedGeneration = 0
  let connection: SocketConnection = 'initial'
  const recoveringTurns = new Map<string, AbortController>()
  /**
   * Asks recovery must not re-deliver: one it already restored, one a frame
   * has delivered, and any the user has answered or the server has resolved.
   * Without the latter, a poll whose snapshot predates the answer would
   * resurrect a card the user is done with, splitting the reply that has
   * since resumed streaming. Deliberately outlives `newChat`/`loadThread`:
   * an `ask_id` carries its `message_id`, so it is never reused.
   */
  const deliveredAsks = new Set<string>()
  const lateAskReports = new Map<string, ReturnType<typeof setTimeout>>()

  function pushError(text: string): void {
    notices.value.push({ level: 'error', text })
  }

  function start(): void {
    ownedGeneration = ++sessionGeneration
    connection = 'initial'
    // The binding only outlives a remount together with its thread: a page
    // with no surviving thread has no resumed turn the binding could serve.
    if (
      conversationStore.threadId === null &&
      localStorage.getItem(THREAD_STORAGE_KEY) === null
    ) {
      rememberedWorkflowId = null
      boundWorkflowId.value = null
    }
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
      const stored = localStorage.getItem(THREAD_STORAGE_KEY)
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
    isCurrent: () => boolean = () => true
  ): Promise<boolean> {
    try {
      const history = await rest.getMessages(threadId)
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      conversationStore.hydrate(history)
      reconcileLiveTurns(HYDRATE_RECOVERY)
      await workflow?.restored?.(conversationStore.latestWorkflowId, isCurrent)
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      return true
    } catch (error) {
      if (!isCurrent()) return false
      if (error instanceof AgentApiError && error.status === 404) {
        if (conversationStore.threadId === threadId)
          conversationStore.setThreadId(null)
        localStorage.removeItem(THREAD_STORAGE_KEY)
        return false
      }
      pushError(error instanceof Error ? error.message : String(error))
      return false
    }
  }

  function stop(): void {
    unsubscribe?.()
    unsubscribeStatus?.()
    unsubscribe = null
    unsubscribeStatus = null
    for (const recovery of recoveringTurns.values()) recovery.abort()
    for (const scheduled of lateAskReports.values()) clearTimeout(scheduled)
    lateAskReports.clear()
    const stoppedGeneration = ownedGeneration
    queueMicrotask(() => {
      if (stoppedGeneration !== sessionGeneration) return
      conversationStore.abortActiveTurn()
      conversationStore.dropBackgroundTurns()
    })
  }

  async function prepareWorkflow(): Promise<void> {
    if (!workflow?.prepare) return
    await Promise.race([
      workflow.prepare().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, PREPARE_TIMEOUT_MS))
    ])
  }

  function recordUnavailableTarget(text: string): void {
    conversationStore.recordFailedSend(
      nextLocalErrorId(),
      text,
      i18n.global.t('agent.targetNavigationUnavailable')
    )
  }

  function postTurn(
    threadId: string,
    text: string,
    origin: TurnOrigin,
    wfContext: WorkflowTurnContext | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    selectionWorkflowId?: () => string | undefined
  ): Promise<AgentTurnAccepted> {
    const input = buildPostInput(
      threadId,
      text,
      origin,
      wfContext,
      attachments,
      tags,
      workflowReferences,
      selectionWorkflowId
    )
    if (wfContext?.id === undefined) return rest.postMessage(threadId, input)
    return rest.postMessage(threadId, { ...input, workflowId: wfContext.id })
  }

  function buildPostInput(
    threadId: string,
    text: string,
    origin: TurnOrigin,
    wfContext: WorkflowTurnContext | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    selectionWorkflowId?: () => string | undefined
  ): PostMessageInput {
    const draft = workflow?.draft?.(origin)
    const unboundTarget = isUnboundTarget(wfContext, boundWorkflowId.value)
    // Resolved here rather than at the call site: `buildPostInput` runs after
    // `prepareWorkflow()`, so a tab whose cloud id was still unresolved on
    // mount has one by now (QAF-19).
    const selectedWorkflowId = selectionWorkflowId?.()
    return {
      content: serializeWorkflowReferences(text, workflowReferences ?? []),
      tabs: workflow?.tabs?.(origin),
      workflowReferences: serializeReferencedWorkflows(
        workflowReferences,
        wfContext?.id
      ),
      selection: selectedNodes(tags, selectedWorkflowId),
      attachments: attachments?.map((attachment) => attachment.ref),
      ...buildTargetFields(threadId, wfContext, draft, unboundTarget)
    }
  }

  function serializeReferencedWorkflows(
    references: WorkflowReference[] | undefined,
    currentWorkflowId: string | undefined
  ) {
    return (references ?? [])
      .filter((reference) => reference.id !== currentWorkflowId)
      .map((reference) => ({
        workflow_id: reference.id,
        name: reference.name
      }))
  }

  function selectedNodes(
    tags: SentTag[] | undefined,
    selectedWorkflowId: string | undefined
  ) {
    if (tags === undefined || tags.length === 0) return undefined
    return {
      node_ids: tags.map((tag) => tag.id),
      ...(selectedWorkflowId !== undefined
        ? { workflow_id: selectedWorkflowId }
        : {})
    }
  }

  function canSendDraft(
    threadId: string,
    wfContext: WorkflowTurnContext | undefined,
    draft: DraftSnapshot | undefined,
    unboundTarget: boolean
  ): boolean {
    if (draft === undefined) return false
    return threadId === 'new' || wfContext?.id !== undefined || unboundTarget
  }

  // current_tab_unbound's own contract (see its generated doc comment) is
  // a tab-level fact: this tab has no cloud id yet. wfContext with no id
  // is exactly that (a saved tab whose cloud id failed to resolve makes
  // wfContext undefined entirely instead - see targetWorkflowTurnContext).
  //
  // boundWorkflowId === null narrows WHEN we assert that fact, and is a
  // client-side policy choice, not part of the field's own meaning: the
  // server has no way yet to tell "this thread's remembered workflow is
  // itself my own prior unbound mint for this same tab" apart from "an
  // unrelated workflow from a different tab" (see
  // TestPostMessageUnboundCurrentTabMintsInsteadOfReusingTheThreadWorkflow
  // in the agent service), so asserting the flag on every turn a still-
  // unbound tab is asked about would mint a fresh, contentless workflow
  // each time. Once any turn this session has bound a workflow, that
  // binding (or the thread's own remembered workflow) is a safer target
  // than minting again. Telling the server this is a selected-but-unbound
  // tab, not "nothing selected", is what keeps the seed from telling the
  // model no workflow is selected - see PM-1429/PM-1430.
  function isUnboundTarget(
    wfContext: WorkflowTurnContext | undefined,
    boundWorkflowId: string | null
  ): boolean {
    return (
      wfContext !== undefined &&
      wfContext.id === undefined &&
      boundWorkflowId === null
    )
  }

  function buildTargetFields(
    threadId: string,
    wfContext: WorkflowTurnContext | undefined,
    draft: DraftSnapshot | undefined,
    unboundTarget: boolean
  ): Pick<PostMessageInput, 'currentTabUnbound' | 'draft'> {
    return {
      ...(unboundTarget ? { currentTabUnbound: true } : {}),
      // unboundTarget must carry its draft alongside it: the server mints a
      // workflow for it, and without the draft that mint starts empty,
      // dropping whatever is already on the tab's canvas.
      ...(canSendDraft(threadId, wfContext, draft, unboundTarget)
        ? { draft }
        : {})
    }
  }

  function acceptTurn(
    ack: AgentTurnAccepted,
    text: string,
    wfContext: WorkflowTurnContext | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[]
  ): void {
    conversationStore.setThreadId(ack.thread_id)
    localStorage.setItem(THREAD_STORAGE_KEY, ack.thread_id)
    if (ack.workflow_id !== undefined) {
      const boundAtAck = boundWorkflowId.value
      bindWorkflow(ack.workflow_id)
      const shouldAdopt =
        wfContext?.id !== undefined ||
        (ack.workflow_id !== boundAtAck &&
          bindingStore.tabPathFor(ack.workflow_id) === undefined)
      if (shouldAdopt) workflow?.adopted(ack.workflow_id, wfContext)
    }
    const turnId = ack.message_id as TurnId
    conversationStore.recordUser(
      turnId,
      text,
      attachments?.map(({ name, previewUrl, ref }) => ({
        name,
        previewUrl,
        ref
      })),
      tags?.map((tag) => `${tag.title} #${tag.id}`),
      workflowReferences
    )
    conversationStore.startTurn(turnId)
    if (wasStopRequestedWhileSending()) {
      stopRequestedWhileSending.value = false
      void stopTurn()
    }
  }

  function recordSendError(error: unknown, text: string): void {
    const admission = parseAdmissionError(error)
    if (admission?.reason === 'no_funds') {
      conversationStore.recordPaywall(
        nextLocalErrorId(),
        text,
        admission.message
      )
      return
    }
    if (admission !== undefined) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        admission.message,
        admission.reason === 'funds_unavailable'
          ? admission.retryAfterSeconds
          : undefined
      )
      return
    }
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
  }

  /**
   * The server will not serve the id this turn was posted under, and the
   * binding that produced it outlives the page. Left in place it poisons the
   * tab: every later turn re-posts the same dead id, and a reload re-affirms
   * the binding through the thread's own workflow pointer.
   *
   * Everything here is keyed by the refused id, never by its tab path: the tab
   * may already have been rebound to a healthy workflow while the POST was in
   * flight. `disowned` evicts the id from the resolver's cloud index, which
   * `cloudIdFor` consults ahead of the binding store.
   */
  function releaseDisownedWorkflow(
    sent: WorkflowTurnContext | undefined,
    error: unknown
  ): void {
    if (sent?.id === undefined || !disownsWorkflow(error)) return
    bindingStore.unbindWorkflow(sent.id)
    workflow?.disowned?.(sent.id)
    if (boundWorkflowId.value === sent.id) boundWorkflowId.value = null
    if (rememberedWorkflowId === sent.id) rememberedWorkflowId = null
  }

  async function performSend(
    text: string,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    selectionWorkflowId?: () => string | undefined
  ): Promise<boolean> {
    const generation = loadGeneration
    const threadAtSend = conversationStore.threadId ?? 'new'
    const originContext = workflow?.current()
    const origin: TurnOrigin =
      originContext === undefined ? null : { tabPath: originContext.tabPath }
    let sentContext: WorkflowTurnContext | undefined
    try {
      await prepareWorkflow()
      if (generation !== loadGeneration) return false
      const wfContext = workflow?.current(origin)
      if (workflowTargetChanged(originContext, wfContext)) {
        recordUnavailableTarget(text)
        return false
      }
      sentContext = wfContext
      const ack = await postTurn(
        threadAtSend,
        text,
        origin,
        wfContext,
        attachments,
        tags,
        workflowReferences,
        selectionWorkflowId
      )
      if (generation !== loadGeneration) return false
      acceptTurn(ack, text, wfContext, attachments, tags, workflowReferences)
      return true
    } catch (error) {
      // Before the generation guard: the binding store is page-global and
      // persisted, so a refusal that lands after newChat()/loadThread() has
      // moved on still has to release, or the dead id survives the reload.
      releaseDisownedWorkflow(sentContext, error)
      if (generation !== loadGeneration) return false
      recordSendError(error, text)
      return false
    }
  }

  function workflowTargetChanged(
    origin: WorkflowTurnContext | undefined,
    current: WorkflowTurnContext | undefined
  ): boolean {
    if (origin?.id === undefined) return false
    return current?.id !== origin.id
  }

  async function sendMessage(
    text: string,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    selectionWorkflowId?: () => string | undefined
  ): Promise<boolean> {
    if (sending.value) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        i18n.global.t('agent.sendBusy')
      )
      return false
    }
    promptEditState.value = { phase: 'idle' }
    sending.value = true
    stopRequestedWhileSending.value = false
    try {
      return await performSend(
        text,
        attachments,
        tags,
        workflowReferences,
        selectionWorkflowId
      )
    } finally {
      sending.value = false
    }
  }

  const stopRequestedWhileSending = ref(false)
  const wasStopRequestedWhileSending = () => stopRequestedWhileSending.value

  async function stopTurn(): Promise<void> {
    const threadId = conversationStore.threadId
    const turnId = conversationStore.activeTurnId
    if (threadId === null || turnId === null) {
      // The POST has not acked yet; remember the intent and cancel on ack.
      if (sending.value) stopRequestedWhileSending.value = true
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

  async function answerAsk(
    askId: string,
    selection: 'run' | 'cancel'
  ): Promise<void> {
    const currentThreadId = conversationStore.threadId
    const messageId = conversationStore.activeTurnId
    if (
      currentThreadId === null ||
      messageId === null ||
      answeringAskIds.value.has(askId)
    )
      return
    setAskAnswering(askId, true)
    deliveredAsks.add(askId)
    try {
      await rest.answerAsk(currentThreadId, askId, [selection])
      // Keep the actions disabled until the canonical resolution frame arrives.
    } catch (error) {
      setAskAnswering(askId, false)
      if (error instanceof AgentApiError && error.status === 409) {
        conversationStore.ingest({
          type: 'agent_ask_resolved',
          data: {
            thread_id: currentThreadId,
            message_id: messageId,
            ask_id: askId,
            status: 'answered',
            selected: null
          }
        })
        return
      }
      reportError(error, { errorType: 'agent_ask_answer_failed' })
      pushError(error instanceof Error ? error.message : String(error))
    }
  }

  let loadGeneration = 0

  function newChat(): void {
    loadGeneration++
    promptEditState.value = { phase: 'idle' }
    conversationStore.stashActiveTurn()
    conversationStore.reset()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    localStorage.removeItem(THREAD_STORAGE_KEY)
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
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    conversationStore.setThreadId(threadId)
    localStorage.setItem(THREAD_STORAGE_KEY, threadId)
    const hydrated = await hydrateFromServer(threadId, isCurrent)
    if (hydrated && isCurrent()) conversationStore.resumeBackgroundTurn()
  }

  function onRaw(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    const type = (raw as { type?: unknown }).type
    if (typeof type !== 'string' || !isAgentEvent(type)) return
    const parsed = parseAgentWsEvent(raw)
    if (!parsed.success) {
      const messageId = (raw as { data?: { message_id?: unknown } }).data
        ?.message_id
      if (type === 'agent_message_done') {
        if (
          typeof messageId !== 'string' ||
          messageId === conversationStore.activeTurnId
        ) {
          conversationStore.abortActiveTurn()
          pushError(i18n.global.t('agent.malformedEvent'))
        } else {
          conversationStore.settleBackgroundTurn(messageId)
        }
      }
      console.warn('[agent] dropping malformed agent event', parsed.error)
      return
    }
    const event = parsed.data
    if (event.type === 'agent_ask_resolved') {
      setAskAnswering(event.data.ask_id, false)
      deliveredAsks.add(event.data.ask_id)
    }
    // An ask already in the ledger is one recovery has supplied, or one the
    // user has finished with. Dropping it here rather than relying on the
    // rendered parts is what stops a frame delayed past its own resolution
    // from drawing a card over a reply that has since resumed.
    if (event.type === 'agent_ask') {
      if (deliveredAsks.has(event.data.ask_id)) {
        withdrawLateAskReport(event.data.ask_id)
        return
      }
      deliveredAsks.add(event.data.ask_id)
    }
    switch (event.type) {
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
        markStoppedTurnReady({
          threadId: event.data.thread_id,
          messageId: toTurnId(event.data.message_id)
        })
    }
  }

  function onStatus(live: boolean): void {
    if (!live) {
      if (connection === 'live') connection = 'dropped'
      return
    }
    const reconnected = connection === 'dropped'
    connection = 'live'
    if (!reconnected) return
    reconcileLiveTurns(RECONNECT_RECOVERY)
  }

  function reconcileLiveTurns(plan: RecoveryPlan): void {
    for (const turn of conversationStore.liveTurns()) {
      void reconcileTurn(turn, plan)
    }
  }

  async function reconcileTurn(
    turn: LiveTurn,
    plan: RecoveryPlan
  ): Promise<void> {
    const key = recoveryKey(turn)
    if (recoveringTurns.has(key)) return
    const recovery = new AbortController()
    recoveringTurns.set(key, recovery)
    try {
      await recoverTurn(turn, plan, ownedGeneration, recovery.signal)
    } catch (error) {
      // `onStatus` floats this job (`void reconcileTurn(turn)`), so a rethrow
      // would land as an `unhandledrejection` the session never sees. Abort is
      // the expected end of a cancelled job; anything else is an unexpected
      // settlement or storage failure and goes through the module's reporter.
      if (!recovery.signal.aborted)
        reportError(error, { errorType: 'failure_recovering_agent_turn' })
    } finally {
      if (recoveringTurns.get(key) === recovery) recoveringTurns.delete(key)
    }
  }

  async function recoverTurn(
    turn: LiveTurn,
    plan: RecoveryPlan,
    generation: number,
    signal: AbortSignal
  ): Promise<void> {
    const { delaysMs } = plan
    let noticed = false
    let consecutiveFailures = 0
    for (let attempt = 0; ; attempt++) {
      await delay(delaysMs[Math.min(attempt, delaysMs.length - 1)], { signal })
      if (!isTurnLive(turn, generation)) return
      const outcome = await fetchTurnOutcome(turn, signal)
      if (!isTurnLive(turn, generation)) return
      if (settleFinishedTurn(turn, outcome)) return
      if (outcome.kind === 'streaming')
        restoreMissingApproval(turn, outcome.pendingAsk, plan.cause)
      if (outcome.kind === 'error' && !noticed) {
        noticed = true
        pushError(outcome.message)
      }
      consecutiveFailures =
        outcome.kind === 'streaming' ? 0 : consecutiveFailures + 1
      if (consecutiveFailures >= TURN_RECOVERY_MAX_CONSECUTIVE_FAILURES)
        return abandonTurnRecovery(turn, outcome)
    }
  }

  function abandonTurnRecovery(turn: LiveTurn, outcome: TurnOutcome): void {
    if (outcome.kind === 'message-missing')
      conversationStore.settleTurn(turn, undefined)
  }

  /**
   * PM-1738: a turn parked on a tool-call approval stays `streaming` until the
   * user answers, so a socket drop that swallowed the `agent_ask` frame leaves
   * the server waiting on a card the panel never drew -- the turn reads as
   * hung and every follow-up post comes back 409. The polled row still carries
   * the unanswered ask, so re-deliver it through the store, which routes it to
   * the same transport the lost frame would have reached, and mirror the one
   * other thing the socket branch does with an ask.
   *
   * Reported at `error` only after a reconnect, where the frame really is
   * gone. A hydrate's poll can instead be racing a broadcast the server had
   * not published when its history fetch went out, so that reads as a warning.
   */
  function restoreMissingApproval(
    turn: LiveTurn,
    pendingAsk: PendingAsk | undefined,
    cause: RecoveryCause
  ): void {
    if (pendingAsk?.kind !== 'run_approval') return
    if (deliveredAsks.has(pendingAsk.ask_id)) return
    if (conversationStore.isApprovalShown(turn, pendingAsk.ask_id)) return
    deliveredAsks.add(pendingAsk.ask_id)
    conversationStore.ingest({
      type: 'agent_ask',
      data: {
        ...pendingAsk,
        thread_id: turn.threadId,
        message_id: turn.messageId
      }
    })
    markStoppedTurnReady(turn)
    reportRestoredApproval(turn, pendingAsk.ask_id, cause)
  }

  /**
   * The server writes the ask row before it publishes the frame, so a poll
   * can restore an ask whose broadcast is merely in flight. Only a reconnect
   * claims a frame was lost, and only once its own broadcast has had a grace
   * window to turn up -- `withdrawLateAskReport` cancels this when it does.
   * A hydrate races the same way but never had a dropped socket to blame, so
   * it files as a warning immediately.
   */
  function reportRestoredApproval(
    turn: LiveTurn,
    askId: string,
    cause: RecoveryCause
  ): void {
    if (cause !== 'reconnect') {
      sendRestoredApprovalReport(turn, askId, cause, 'warning')
      return
    }
    lateAskReports.set(
      askId,
      setTimeout(() => {
        lateAskReports.delete(askId)
        sendRestoredApprovalReport(turn, askId, cause, 'error')
      }, LATE_ASK_FRAME_GRACE_MS)
    )
  }

  function withdrawLateAskReport(askId: string): void {
    const scheduled = lateAskReports.get(askId)
    if (scheduled === undefined) return
    clearTimeout(scheduled)
    lateAskReports.delete(askId)
  }

  function sendRestoredApprovalReport(
    turn: LiveTurn,
    askId: string,
    cause: RecoveryCause,
    level: 'error' | 'warning'
  ): void {
    reportError(
      new Error('Agent approval ask was missing from the panel when polled'),
      {
        errorType: 'failure_delivering_agent_approval_ask',
        level,
        tags: {
          feature_area: 'agent',
          operation: 'recovery',
          recovery_cause: cause
        },
        context: { threadId: turn.threadId, messageId: turn.messageId, askId }
      }
    )
  }

  function isTurnLive(turn: LiveTurn, generation: number): boolean {
    return (
      generation === sessionGeneration &&
      conversationStore
        .liveTurns()
        .some(
          (live) =>
            live.threadId === turn.threadId && live.messageId === turn.messageId
        )
    )
  }

  function settleFinishedTurn(turn: LiveTurn, outcome: TurnOutcome): boolean {
    switch (outcome.kind) {
      case 'terminal':
        conversationStore.settleTurn(turn, outcome.text)
        markStoppedTurnReady(turn)
        return true
      case 'thread-missing':
        forgetDeletedThread(turn)
        return true
      case 'message-missing':
      case 'streaming':
      case 'error':
        return false
      default: {
        const unhandled: never = outcome
        return unhandled
      }
    }
  }

  function markStoppedTurnReady(turn: LiveTurn): void {
    if (
      promptEditState.value.phase !== 'stopping' ||
      turn.messageId !== promptEditState.value.turnId ||
      turn.threadId !== conversationStore.threadId
    )
      return
    promptEditState.value = {
      phase: 'ready',
      turnId: promptEditState.value.turnId
    }
  }

  async function fetchTurnOutcome(
    turn: LiveTurn,
    signal: AbortSignal
  ): Promise<TurnOutcome> {
    try {
      const history = await rest.getMessages(turn.threadId, { signal })
      const row = history.find((entry) => entry.id === turn.messageId)
      if (!row) return { kind: 'message-missing' }
      if (row.status === 'streaming')
        return { kind: 'streaming', pendingAsk: row.pending_ask }
      const text = typeof row.content?.text === 'string' ? row.content.text : ''
      return { kind: 'terminal', text }
    } catch (error) {
      if (signal.aborted) throw error
      return turnOutcomeFromError(error)
    }
  }

  function forgetDeletedThread(turn: LiveTurn): void {
    conversationStore.settleTurn(turn, undefined)
    if (conversationStore.threadId !== turn.threadId) return
    conversationStore.setThreadId(null)
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    localStorage.removeItem(THREAD_STORAGE_KEY)
  }

  const isSending = computed(() => sending.value)
  const editableTurnId = computed(() =>
    promptEditState.value.phase === 'ready'
      ? promptEditState.value.turnId
      : null
  )

  function bindWorkflow(workflowId: string): void {
    boundWorkflowId.value = workflowId
    rememberedWorkflowId = workflowId
  }

  return {
    boundWorkflowId: computed(() => boundWorkflowId.value),
    bindWorkflow,
    isSending,
    editableTurnId,
    start,
    stop,
    sendMessage,
    stopTurn,
    answerAsk,
    answeringAskIds: computed(() => answeringAskIds.value),
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
