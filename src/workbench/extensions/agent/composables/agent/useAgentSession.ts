import { computed, ref } from 'vue'

import { i18n } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  AgentStopClickedMetadata,
  AgentStopMethod,
  AgentThreadStartSource,
  AgentWorkflowBindSource
} from '@/platform/telemetry/types'
import { clearLegacyAgentStorage } from '@/platform/workflow/persistence/base/storageIO'
import {
  getWorkspaceId,
  StorageKeys
} from '@/platform/workflow/persistence/base/storageKeys'
import { createUuidv4 } from '@/utils/uuid'
import type {
  AgentActiveTabData,
  AgentTurnAccepted,
  AgentWsEvent,
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
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import type { WorkflowReference } from '../../types/workflowReference'
import { serializeWorkflowReferences } from '../../utils/workflowReferenceText'

export interface AgentEventSource {
  subscribe(listener: (raw: unknown) => void): () => void
  onStatus?(listener: (live: boolean) => void): () => void
}

export interface SessionNotice {
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

/**
 * Thread starts the session attributes through its pending source;
 * `history_select` is reported where the history picker resolves instead.
 */
export type AgentSessionThreadStartSource = Exclude<
  AgentThreadStartSource,
  'history_select'
>

export interface AgentSessionDeps {
  rest: AgentRestClient
  events: AgentEventSource
  onThreadStarted?: (source: AgentSessionThreadStartSource) => void
  onAskResolved?: (askId: string) => void
  workflow?: {
    /** Resolve fresh versus restored startup before asynchronous hydration. */
    initialize?(hasThread: boolean): void
    // origin, when given, pins resolution to the tab that initiated the send
    // instead of the target selected when this is called - it is read
    // after prepare() so cloud ids it resolves are fresh, but must still
    // describe the pre-await originating tab, not a later switch. See
    // TurnOrigin for why "no origin tab" is a value rather than an omission.
    current(origin?: TurnOrigin): WorkflowTurnContext | undefined
    adopted(
      workflowId: string,
      sent: WorkflowTurnContext | undefined,
      previousWorkflowId: string | null
    ): void
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

const PREPARE_TIMEOUT_MS = 3000

/**
 * Statuses the answer endpoint uses to say this ask will never be answerable
 * by this client: 409 once it is resolved, 403 for a thread/workspace or
 * ownership mismatch, 404 once the ask or its thread is gone. Retrying any of
 * them just reproduces it, so the card is dropped rather than re-offered. 5xx
 * is deliberately absent — the server documents it as retryable.
 */
const TERMINAL_ANSWER_STATUSES = new Set([403, 404, 409])

/**
 * PM-1658: backoff before re-driving a consent answer. The server documents
 * 5xx here as retryable and re-drives the STORED selection, so resending the
 * same answer is always safe and is the only recovery that cannot turn into a
 * contradictory second choice. One retry only: the card is disabled for the
 * whole sequence, which with ANSWER_ASK_TIMEOUT_MS keeps the worst case under
 * the shared 60s request deadline it replaces.
 */
const ANSWER_RETRY_BACKOFF_MS = [300]

/**
 * A rejected fetch never reached the server, and 5xx is the status the server
 * documents as retryable. Everything else either answered (a schema failure
 * means a 202 body we could not read — replaying it is a wasted request) or
 * refuses permanently, as 501 does on deployments with no durable turn to
 * wake.
 */
function isRetryableAnswerFailure(error: unknown): boolean {
  if (error instanceof AgentApiError)
    return error.status >= 500 && error.status !== 501
  return error instanceof TypeError || error instanceof DOMException
}

let sessionGeneration = 0

/**
 * Page-lifetime binding memory: the workflow a resumed turn belongs to must
 * survive a panel remount. Module-level like `sessionGeneration`;
 * newChat/loadThread clear it.
 */
let rememberedWorkflowId: string | null = null
const turnStartedAt = new Map<TurnId, number>()

/**
 * Module-level like `turnStartedAt`: a POST outlives the panel that sent it,
 * so a stop clicked from a remounted panel before the acknowledgement must
 * reach the continuation that acks. One owner: armed while a send is in
 * flight, consumed exactly once at ack.
 */
let sendInFlight = false
let stopPendingAck: { method: AgentStopMethod | undefined } | null = null

function consumeStopPendingAck() {
  const pending = stopPendingAck
  stopPendingAck = null
  return pending
}

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
  const { rest, events, onThreadStarted, onAskResolved, workflow } = deps
  const threadStorageKey = StorageKeys.agentThread(getWorkspaceId())
  clearLegacyAgentStorage()

  const conversationStore = useAgentConversationStore()
  const bindingStore = useAgentWorkflowTabBindingStore()
  /**
   * The workflow the session is bound to (set on turn ack or an active-tab
   * switch, cleared by newChat/loadThread) - the CRDT follower's subscribe
   * target.
   */
  const boundWorkflowId = ref<string | null>(rememberedWorkflowId)

  /**
   * H8 reporting state, kept beside the binding it describes: the workflow
   * last reported for the current thread (suppresses the ack's re-report of a
   * transition already committed by a selection), and a target selection
   * committed before its thread exists, consumed by the ack that binds it.
   */
  let reportedWorkflowBind: { threadId: string; workflowId: string } | null =
    null
  let pendingWorkflowBind: {
    workflowId: string
    previousWorkflowId: string | null
    source: 'selector_chip' | 'restored'
  } | null = null

  function reportWorkflowBound(
    workflowId: string,
    previousWorkflowId: string | null,
    source: AgentWorkflowBindSource
  ): void {
    const currentThreadId = conversationStore.threadId
    if (currentThreadId === null) {
      if (source === 'selector_chip' || source === 'restored')
        pendingWorkflowBind = { workflowId, previousWorkflowId, source }
      return
    }
    const pending =
      pendingWorkflowBind?.workflowId === workflowId
        ? pendingWorkflowBind
        : null
    pendingWorkflowBind = null
    const lastReported =
      reportedWorkflowBind?.threadId === currentThreadId
        ? reportedWorkflowBind.workflowId
        : (pending?.previousWorkflowId ?? previousWorkflowId)
    if (workflowId === lastReported) return
    reportedWorkflowBind = { threadId: currentThreadId, workflowId }
    useTelemetry()?.trackAgentWorkflowBound({
      thread_id: currentThreadId,
      workflow_id: workflowId,
      prev_workflow_id: lastReported,
      bind_source: pending?.source ?? source
    })
  }

  const notices = ref<SessionNotice[]>([])
  const promptEditState = ref<PromptEditState>({ phase: 'idle' })
  const sending = ref(false)
  const answeringAskIds = computed(() => conversationStore.answeringAskIds)
  const pendingThreadSource = ref<AgentSessionThreadStartSource | null>(
    'first_open'
  )

  function nextLocalErrorId(): TurnId {
    return toTurnId(`local-error-${createUuidv4()}`)
  }

  let unsubscribe: (() => void) | null = null
  let unsubscribeStatus: (() => void) | null = null
  let ownedGeneration = 0
  // The status source reports its current state synchronously on subscribe
  // (see agentEventSource.onStatus), so the first callback is a snapshot,
  // not a transition. Track whether we've ever observed a live connection so
  // an initial `false` (still connecting, not yet dropped) doesn't abort a
  // turn that survived a remount.
  let everLive = false

  function pushError(text: string): void {
    notices.value.push({ level: 'error', text })
  }

  function start(): void {
    ownedGeneration = ++sessionGeneration
    everLive = false
    const surviving = conversationStore.threadId
    const stored =
      conversationStore.messages.length === 0
        ? localStorage.getItem(threadStorageKey)
        : null
    workflow?.initialize?.(surviving !== null || stored !== null)
    // The binding only outlives a remount together with its thread: a page
    // with no surviving thread has no resumed turn the binding could serve.
    if (
      conversationStore.threadId === null &&
      localStorage.getItem(threadStorageKey) === null
    ) {
      rememberedWorkflowId = null
      boundWorkflowId.value = null
    }
    unsubscribe = events.subscribe(onRaw)
    if (events.onStatus) unsubscribeStatus = events.onStatus(onStatus)
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
    if (stored !== null) {
      const generation = ++loadGeneration
      conversationStore.setThreadId(stored)
      void hydrateFromServer(
        stored,
        () =>
          generation === loadGeneration && ownedGeneration === sessionGeneration
      )
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
      await workflow?.restored?.(conversationStore.latestWorkflowId, isCurrent)
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      return true
    } catch (error) {
      if (!isCurrent()) return false
      if (error instanceof AgentApiError && error.status === 404) {
        if (conversationStore.threadId === threadId)
          conversationStore.setThreadId(null)
        localStorage.removeItem(threadStorageKey)
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
    const stoppedGeneration = ownedGeneration
    queueMicrotask(() => {
      if (stoppedGeneration !== sessionGeneration) return
      loadGeneration++
      turnStartedAt.clear()
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

  function recordTurnStarted(turnId: TurnId, startsThread: boolean): void {
    turnStartedAt.set(turnId, Date.now())
    if (startsThread && pendingThreadSource.value !== null) {
      onThreadStarted?.(pendingThreadSource.value)
      pendingThreadSource.value = null
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
    const startsThread = conversationStore.threadId === null
    conversationStore.setThreadId(ack.thread_id)
    localStorage.setItem(threadStorageKey, ack.thread_id)
    if (ack.workflow_id !== undefined) {
      const boundAtAck = boundWorkflowId.value
      bindWorkflow(ack.workflow_id)
      const shouldAdopt =
        wfContext?.id !== undefined ||
        (ack.workflow_id !== boundAtAck &&
          bindingStore.tabPathFor(ack.workflow_id) === undefined)
      if (shouldAdopt) workflow?.adopted(ack.workflow_id, wfContext, boundAtAck)
    }
    const turnId = toTurnId(ack.message_id)
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
    recordTurnStarted(turnId, startsThread)
    const pendingStop = consumeStopPendingAck()
    if (pendingStop !== null) void stopTurn(pendingStop.method)
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
    sendInFlight = true
    stopPendingAck = null
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
      sendInFlight = false
    }
  }

  function captureStopMetadata(
    turnId: TurnId,
    method: AgentStopMethod | undefined
  ): AgentStopClickedMetadata | null {
    if (method === undefined) return null
    const startedAt = turnStartedAt.get(turnId)
    return {
      method,
      turn_id: turnId,
      turn_elapsed_ms:
        startedAt === undefined ? null : Math.max(0, Date.now() - startedAt)
    }
  }

  function forgetActiveTurnStartedAt(): void {
    const activeTurnId = conversationStore.activeTurnId
    if (activeTurnId !== null) turnStartedAt.delete(activeTurnId)
  }

  function isStoppingTurn(turnId: TurnId): boolean {
    return (
      promptEditState.value.phase === 'stopping' &&
      promptEditState.value.turnId === turnId
    )
  }

  function trackCommittedStop(metadata: AgentStopClickedMetadata | null): void {
    if (metadata !== null) useTelemetry()?.trackAgentStopClicked(metadata)
  }

  function handleStopFailure(error: unknown): void {
    if (error instanceof AgentApiError) {
      if (error.status === 409) return
      promptEditState.value = { phase: 'idle' }
      pushError(error.message)
      return
    }
    promptEditState.value = { phase: 'idle' }
    pushError(error instanceof Error ? error.message : String(error))
  }

  async function stopTurn(method?: AgentStopMethod): Promise<void> {
    const threadId = conversationStore.threadId
    const turnId = conversationStore.activeTurnId
    if (threadId === null || turnId === null) {
      // The POST has not acked yet; remember the intent and cancel on ack.
      // sendInFlight, not this instance's sending: the panel that posted may
      // have been remounted, and the stop arrives through the new instance.
      if (sendInFlight) stopPendingAck = { method }
      return
    }
    if (isStoppingTurn(turnId)) return
    promptEditState.value = { phase: 'stopping', turnId }
    const stopMetadata = captureStopMetadata(
      conversationStore.activeMessageId ?? turnId,
      method
    )
    try {
      await rest.cancelMessage(threadId, turnId)
      trackCommittedStop(stopMetadata)
    } catch (error) {
      handleStopFailure(error)
    }
  }

  async function answerAsk(
    askId: string,
    selection: 'run' | 'cancel'
  ): Promise<boolean> {
    const currentThreadId = conversationStore.threadId
    if (currentThreadId === null) {
      // PM-1658: the card is on screen, so a click on it is never a no-op.
      reportError(
        new Error('run approval answered with no thread to send on'),
        {
          errorType: 'agent_ask_answer_unroutable'
        }
      )
      pushError(i18n.global.t('agent.runApproval.answerFailed'))
      // Nothing can ever answer this card, so retire it rather than let every
      // further click raise another toast and another telemetry event.
      conversationStore.retireAsk(askId)
      return false
    }
    // PM-1658: deliberately NOT gated on an active turn. The endpoint is keyed
    // by thread and ask alone — it never looks a turn up — and the server
    // parks a run approval for days, so a card can still be answered long
    // after the turn that raised it stopped streaming to this client.
    if (answeringAskIds.value.has(askId)) return false
    conversationStore.recordAskSelection(askId, selection)
    conversationStore.setAskAnswering(askId, true)
    try {
      await sendAnswer(currentThreadId, askId, selection)
      conversationStore.commitAsk(askId)
      return true
    } catch (error) {
      // A resolution frame can land while this request is still out, and it
      // retires the card on the way through. The ask is settled and gone, so
      // whatever this rejection says about delivery is no longer news the user
      // can act on — any mismatch worth telling them about has already been
      // raised by reportSupersededAnswer.
      if (!answeringAskIds.value.has(askId)) return false
      if (
        error instanceof AgentApiError &&
        TERMINAL_ANSWER_STATUSES.has(error.status)
      ) {
        // A 409 is the ordinary double-click, and the ask really is resolved,
        // so it needs neither telemetry nor a notice. The rest mean this
        // client could never have answered, which the user has to be told
        // about or the card simply vanishes as though it had worked.
        if (error.status !== 409) {
          reportError(error, { errorType: 'agent_ask_answer_refused' })
          pushError(i18n.global.t('agent.runApproval.answerFailed'))
        }
        conversationStore.retireAsk(askId)
        return false
      }
      reportError(error, { errorType: 'agent_ask_answer_failed' })
      // Every re-drive above has been spent. The card cannot simply go back
      // into service: the server CASes an answer onto the row BEFORE it wakes
      // the turn and reports 500 for the wake alone, so this may already have
      // authorized the run, and it answers any later click by replaying THIS
      // selection while the card disappears as though the new one had taken
      // effect. On a spend authorization that is the wrong way to be wrong, so
      // retire the card and send the user somewhere that shows the truth: a
      // reload re-reads the ask from the thread and renders it again if it is
      // genuinely still pending.
      conversationStore.retireAsk(askId)
      pushError(i18n.global.t('agent.runApproval.answerUncertain'))
      return false
    }
  }

  /**
   * PM-1658: the server commits the FIRST answer an ask receives and takes
   * every later one with 202 while replaying the stored selection, so another
   * tab — or this one before a reload — can decide a card this client also
   * answered. The resolution frame names the selection that actually won, so
   * when it disagrees with ours, the card is about to disappear on someone
   * else's choice and the user has to be told rather than left reading the
   * dismissal as their own.
   */
  function reportSupersededAnswer(
    askId: string,
    settled: string[] | null
  ): void {
    const submitted = conversationStore.submittedAskSelection(askId)
    if (
      submitted === undefined ||
      settled === null ||
      settled.length === 0 ||
      settled.includes(submitted)
    )
      return
    reportError(
      new Error(
        `run approval resolved as ${settled.join(',')}, not ${submitted}`
      ),
      { errorType: 'agent_ask_answer_superseded' }
    )
    pushError(i18n.global.t('agent.runApproval.answerSuperseded'))
  }

  async function sendAnswer(
    threadId: string,
    askId: string,
    selection: 'run' | 'cancel'
  ): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        await rest.answerAsk(threadId, askId, [selection])
        return
      } catch (error) {
        if (
          attempt >= ANSWER_RETRY_BACKOFF_MS.length ||
          !isRetryableAnswerFailure(error)
        )
          throw error
        await new Promise((resolve) =>
          setTimeout(resolve, ANSWER_RETRY_BACKOFF_MS[attempt])
        )
      }
    }
  }

  let loadGeneration = 0

  function newChat(
    source?: Exclude<AgentSessionThreadStartSource, 'first_open'>
  ): void {
    loadGeneration++
    promptEditState.value = { phase: 'idle' }
    conversationStore.stashActiveTurn()
    conversationStore.reset()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    pendingWorkflowBind = null
    localStorage.removeItem(threadStorageKey)
    pendingThreadSource.value = source ?? null
  }

  function listThreads() {
    return rest.listThreads()
  }

  async function loadThread(threadId: string): Promise<boolean> {
    const generation = ++loadGeneration
    promptEditState.value = { phase: 'idle' }
    const isCurrent = () =>
      generation === loadGeneration && ownedGeneration === sessionGeneration
    conversationStore.stashActiveTurn()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    pendingWorkflowBind = null
    conversationStore.setThreadId(threadId)
    localStorage.setItem(threadStorageKey, threadId)
    const hydrated = await hydrateFromServer(threadId, isCurrent)
    if (hydrated && isCurrent()) conversationStore.resumeBackgroundTurn()
    return hydrated && isCurrent()
  }

  function malformedEventTurnId(raw: object): TurnId | undefined {
    if (!('data' in raw) || typeof raw.data !== 'object' || raw.data === null)
      return undefined
    if (!('message_id' in raw.data)) return undefined
    const messageId = raw.data.message_id
    return typeof messageId === 'string' ? toTurnId(messageId) : undefined
  }

  function handleMalformedEvent(
    type: string,
    raw: object,
    error: unknown
  ): void {
    const turnId = malformedEventTurnId(raw)
    if (type === 'agent_message_done') {
      if (turnId !== undefined) turnStartedAt.delete(turnId)
      if (turnId === undefined || turnId === conversationStore.activeTurnId) {
        forgetActiveTurnStartedAt()
        conversationStore.abortActiveTurn()
        pushError(i18n.global.t('agent.malformedEvent'))
      } else {
        conversationStore.settleBackgroundTurn(turnId)
      }
    }
    console.warn('[agent] dropping malformed agent event', error)
  }

  function handleMessageDone(
    event: Extract<AgentWsEvent, { type: 'agent_message_done' }>
  ): void {
    turnStartedAt.delete(toTurnId(event.data.message_id))
    if (
      promptEditState.value.phase === 'stopping' &&
      event.data.message_id === promptEditState.value.turnId &&
      event.data.thread_id === conversationStore.threadId
    )
      promptEditState.value = {
        phase: 'ready',
        turnId: promptEditState.value.turnId
      }
  }

  function handleAgentEvent(event: AgentWsEvent): void {
    if (event.type === 'agent_ask_resolved') {
      reportSupersededAnswer(event.data.ask_id, event.data.selected)
      // Not just un-busying it: `ingest` below routes this frame through the
      // owning turn's transport, and the turn is gone in exactly the case that
      // matters, so on its own it would re-enable a card it cannot remove.
      conversationStore.retireAsk(event.data.ask_id)
      onAskResolved?.(event.data.ask_id)
    }
    conversationStore.ingest(event)
    if (event.type === 'agent_active_tab') {
      if (
        event.data.thread_id === undefined ||
        event.data.thread_id === conversationStore.threadId
      )
        workflow?.activeTab?.(event.data)
      return
    }
    if (event.type === 'agent_message_done') handleMessageDone(event)
  }

  function onRaw(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    const type = (raw as { type?: unknown }).type
    if (typeof type !== 'string' || !isAgentEvent(type)) return
    const parsed = parseAgentWsEvent(raw)
    if (!parsed.success) {
      handleMalformedEvent(type, raw, parsed.error)
      return
    }
    handleAgentEvent(parsed.data)
  }

  function onStatus(live: boolean): void {
    if (live) {
      everLive = true
      return
    }
    // Only a real live->down transition means a turn's stream was actually
    // interrupted. An initial `false` (socket not open yet) is not a
    // reconnect and must not abort a turn that survived a remount.
    if (!everLive) return
    turnStartedAt.clear()
    conversationStore.abortActiveTurn()
    conversationStore.dropBackgroundTurns()
    // After the teardown, never before: settling a transport republishes its
    // own copy of the message, which would put a dismissed card back.
    conversationStore.dismissCommittedAsks()
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
    reportWorkflowBound,
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
