import { computed, shallowRef } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ThreadListing } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

const LANDING_CHAT_LIMIT = 5

type OpeningSource = 'list' | 'resume' | 'only_chat'

type Opening = { threadId: string; workflowId: string; source: OpeningSource }

type OpeningOutcome = 'settled' | 'failed'

function opensAutomatically(opening: Opening): boolean {
  return opening.source !== 'list'
}

function marksFailedRow(opening: Opening): boolean {
  return opening.source !== 'resume'
}

type ListPhase = 'hidden' | 'loading' | 'ready' | 'failed'

type FollowState =
  | { status: 'idle'; generation: number }
  | {
      status: 'following'
      generation: number
      workflow: ComfyWorkflow
      workflowId: string | null
      list: ListPhase
      opening: Opening | null
      failedId: string | null
    }

type FollowOperation = Pick<
  Extract<FollowState, { status: 'following' }>,
  'generation' | 'workflow'
>

export type FollowLanding = {
  workflowName: string
  status: 'loading' | 'ready' | 'failed'
  chats: ChatSession[]
  hasMore: boolean
  openingId: string | null
  failedId: string | null
}

type WorkflowLookup =
  | { status: 'found'; workflowId: string }
  | { status: 'none' }
  | { status: 'unknown' }

type FollowEvent =
  | { type: 'requested'; workflow: ComfyWorkflow; heldBack: boolean }
  | {
      type: 'list_changed'
      generation: number
      workflowId: string | null
      list: ListPhase
    }
  | { type: 'opening_started'; generation: number; opening: Opening }
  | { type: 'opening_failed'; generation: number; threadId: string }
  | { type: 'opening_done'; generation: number }
  | { type: 'abandoned' }
  | { type: 'retired' }

type FollowDeps = {
  activeWorkflow: () => ComfyWorkflow | null
  selectedTarget: () => ComfyWorkflow | null
  currentThreadId: () => string | null
  chatsFor: (workflowId: string) => ChatSession[]
  openChatFor: (workflowId: string) => string | undefined
  forgetOpenChat: (threadId: string) => void
  followsVisibleWorkflow: () => boolean
  hasDraft: () => boolean
  userEngaged: () => boolean
  cloudIdFor: (workflow: ComfyWorkflow) => string | undefined
  refreshCloudWorkflowIds: () => Promise<boolean>
  refreshHistory: (
    uiTreatment?: 'error_overlay' | 'none',
    workflowId?: string
  ) => Promise<ThreadListing['status'] | 'superseded'>
  loadThread: (
    threadId: string,
    isCurrent: () => boolean,
    options: { keepOpenChatUntilLoaded: boolean }
  ) => Promise<boolean>
  clearDraft: () => void
  showBlankChat: () => void
  trackThreadStarted: () => void
  restoreThreadWorkflow: (
    workflowId: string | undefined,
    isCurrent: () => boolean
  ) => Promise<boolean> | boolean
  adoptWorkflowTarget: (workflow: ComfyWorkflow, workflowId: string) => void
  adoptRestoredWorkflowTab: (workflowId: string) => void
}

function requestedState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'requested' }>
): FollowState {
  const generation = state.generation + 1
  return event.heldBack
    ? { status: 'idle', generation }
    : {
        status: 'following',
        generation,
        workflow: event.workflow,
        workflowId: null,
        list: 'hidden',
        opening: null,
        failedId: null
      }
}

function listChangedState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'list_changed' }>
): FollowState {
  if (state.status !== 'following' || state.generation !== event.generation)
    return state
  return { ...state, workflowId: event.workflowId, list: event.list }
}

function openingStartedState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'opening_started' }>
): FollowState {
  if (state.status !== 'following' || state.generation !== event.generation)
    return state
  return { ...state, opening: event.opening, failedId: null }
}

function openingFailedState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'opening_failed' }>
): FollowState {
  if (state.status !== 'following' || state.generation !== event.generation)
    return state
  return {
    ...state,
    opening: null,
    failedId:
      state.opening !== null && marksFailedRow(state.opening)
        ? event.threadId
        : null
  }
}

function openingDoneState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'opening_done' }>
): FollowState {
  return state.status === 'following' && state.generation === event.generation
    ? { status: 'idle', generation: state.generation }
    : state
}

function abandonedState(state: FollowState): FollowState {
  if (
    state.status !== 'following' ||
    !state.opening ||
    !opensAutomatically(state.opening)
  )
    return state
  return {
    ...state,
    generation: state.generation + 1,
    opening: null,
    list: 'hidden'
  }
}

function describeLanding(
  followed: Extract<FollowState, { status: 'following' }>,
  chats: ChatSession[]
): FollowLanding | null {
  if (followed.list === 'hidden') return null
  const listedWhileLoading = followed.list === 'loading' && chats.length > 1
  const status = listedWhileLoading ? 'ready' : followed.list
  if (status === 'ready' && chats.length === 0) return null
  return {
    workflowName: followed.workflow.filename,
    status,
    chats: chats.slice(0, LANDING_CHAT_LIMIT),
    hasMore: chats.length > LANDING_CHAT_LIMIT,
    openingId:
      followed.opening?.source === 'list' ? followed.opening.threadId : null,
    failedId: followed.failedId
  }
}

function reduceFollow(state: FollowState, event: FollowEvent): FollowState {
  switch (event.type) {
    case 'requested':
      return requestedState(state, event)
    case 'list_changed':
      return listChangedState(state, event)
    case 'opening_started':
      return openingStartedState(state, event)
    case 'opening_failed':
      return openingFailedState(state, event)
    case 'opening_done':
      return openingDoneState(state, event)
    case 'abandoned':
      return abandonedState(state)
    case 'retired':
      return { status: 'idle', generation: state.generation + 1 }
  }
}

export function useAgentWorkflowChatFollow(deps: FollowDeps) {
  const state = shallowRef<FollowState>({ status: 'idle', generation: 0 })

  function dispatch(event: FollowEvent): void {
    state.value = reduceFollow(state.value, event)
  }

  function heldBack(workflow: ComfyWorkflow): boolean {
    const target = deps.selectedTarget()
    const chatTargetsWorkflow =
      !deps.followsVisibleWorkflow() && target?.path === workflow.path
    return deps.userEngaged() || chatTargetsWorkflow
  }

  function isCurrent(operation: FollowOperation): boolean {
    return (
      state.value.generation === operation.generation &&
      deps.activeWorkflow()?.path === operation.workflow.path
    )
  }

  function isCurrentAndIdle(operation: FollowOperation): boolean {
    return isCurrent(operation) && !deps.userEngaged()
  }

  function isUnsavedTabWithoutBinding(workflow: ComfyWorkflow): boolean {
    return workflow.isTemporary && deps.cloudIdFor(workflow) === undefined
  }

  async function lookUpWorkflow(
    workflow: ComfyWorkflow
  ): Promise<WorkflowLookup> {
    const existing = deps.cloudIdFor(workflow)
    if (existing !== undefined) return { status: 'found', workflowId: existing }
    const listed = await deps.refreshCloudWorkflowIds()
    const refreshed = deps.cloudIdFor(workflow)
    if (refreshed !== undefined)
      return { status: 'found', workflowId: refreshed }
    return { status: listed ? 'none' : 'unknown' }
  }

  function showBlankChat(): void {
    const blankChatAlreadyFollowsVisibleTab =
      deps.currentThreadId() === null && deps.followsVisibleWorkflow()
    if (blankChatAlreadyFollowsVisibleTab) return
    deps.showBlankChat()
    if (!deps.hasDraft()) deps.clearDraft()
  }

  function openingFinished(): void {
    if (!deps.hasDraft()) deps.clearDraft()
    deps.trackThreadStarted()
  }

  async function openFollowedChat(
    operation: FollowOperation,
    opening: Opening,
    isStillWanted: () => boolean
  ): Promise<OpeningOutcome> {
    dispatch({
      type: 'opening_started',
      generation: operation.generation,
      opening
    })
    const opened = await deps.loadThread(opening.threadId, isStillWanted, {
      keepOpenChatUntilLoaded: true
    })
    if (!isStillWanted()) return 'settled'
    if (!opened) {
      dispatch({
        type: 'opening_failed',
        generation: operation.generation,
        threadId: opening.threadId
      })
      return 'failed'
    }
    dispatch({ type: 'opening_done', generation: operation.generation })
    openingFinished()
    return 'settled'
  }

  function rememberedChat(
    workflow: ComfyWorkflow
  ): { threadId: string; workflowId: string } | undefined {
    const workflowId = deps.cloudIdFor(workflow)
    if (workflowId === undefined) return undefined
    const threadId = deps.openChatFor(workflowId)
    return threadId === undefined ? undefined : { threadId, workflowId }
  }

  function showList(
    operation: FollowOperation,
    workflowId: string | null,
    list: ListPhase
  ): void {
    dispatch({
      type: 'list_changed',
      generation: operation.generation,
      workflowId,
      list
    })
  }

  async function openOnlyChat(
    operation: FollowOperation,
    workflowId: string,
    threadId: string
  ): Promise<void> {
    const outcome = await openFollowedChat(
      operation,
      { threadId, workflowId, source: 'only_chat' },
      () => isCurrentAndIdle(operation)
    )
    if (outcome === 'failed') showList(operation, workflowId, 'ready')
  }

  async function landOnChats(
    operation: FollowOperation,
    workflowId: string,
    options: { mayOpenOnlyChat: boolean; failedThreadId?: string }
  ): Promise<void> {
    const chats = deps.chatsFor(workflowId)
    const onlyChat = chats.length === 1 ? chats[0] : undefined
    const opensOnlyChat =
      options.mayOpenOnlyChat &&
      onlyChat !== undefined &&
      onlyChat.id !== options.failedThreadId &&
      isCurrentAndIdle(operation)
    if (opensOnlyChat) return openOnlyChat(operation, workflowId, onlyChat.id)
    showList(operation, workflowId, 'ready')
  }

  async function landOnKnownChats(
    operation: FollowOperation,
    workflowId: string,
    failedThreadId?: string
  ): Promise<void> {
    const landed = landOnChats(operation, workflowId, {
      mayOpenOnlyChat: true,
      failedThreadId
    })
    void deps.refreshHistory('none', workflowId)
    await landed
  }

  async function landOnFreshChats(
    operation: FollowOperation,
    workflowId: string,
    failedThreadId?: string
  ): Promise<void> {
    showList(operation, workflowId, 'loading')
    const outcome = await deps.refreshHistory('none', workflowId)
    if (!isCurrent(operation)) return
    if (outcome === 'failed' || outcome === 'incomplete')
      return showList(operation, workflowId, 'failed')
    if (deps.chatsFor(workflowId).length === 0)
      return showList(operation, workflowId, 'hidden')
    await landOnChats(operation, workflowId, {
      mayOpenOnlyChat: outcome === 'complete',
      failedThreadId
    })
  }

  async function showLanding(
    workflow: ComfyWorkflow,
    operation: FollowOperation,
    failedThreadId?: string
  ): Promise<void> {
    if (isUnsavedTabWithoutBinding(workflow)) return
    const known = deps.cloudIdFor(workflow)
    if (known !== undefined && deps.chatsFor(known).length > 0)
      return landOnKnownChats(operation, known, failedThreadId)
    showList(operation, known ?? null, 'loading')
    const lookup = await lookUpWorkflow(workflow)
    if (!isCurrent(operation)) return
    if (lookup.status !== 'found')
      return showList(
        operation,
        null,
        lookup.status === 'unknown' ? 'failed' : 'hidden'
      )
    if (deps.chatsFor(lookup.workflowId).length > 0)
      return landOnKnownChats(operation, lookup.workflowId, failedThreadId)
    await landOnFreshChats(operation, lookup.workflowId, failedThreadId)
  }

  async function followTab(workflow: ComfyWorkflow): Promise<void> {
    dispatch({ type: 'requested', workflow, heldBack: heldBack(workflow) })
    const operation = state.value
    if (operation.status !== 'following') return
    const remembered = rememberedChat(workflow)
    if (remembered?.threadId === deps.currentThreadId()) {
      dispatch({ type: 'retired' })
      return
    }
    showBlankChat()
    if (remembered) {
      const outcome = await openFollowedChat(
        operation,
        { ...remembered, source: 'resume' },
        () => isCurrentAndIdle(operation)
      )
      if (outcome === 'settled') return
      deps.forgetOpenChat(remembered.threadId)
    }
    if (isCurrent(operation))
      await showLanding(workflow, operation, remembered?.threadId)
  }

  async function openChat(threadId: string): Promise<void> {
    const landing = state.value
    if (
      landing.status !== 'following' ||
      landing.workflowId === null ||
      landing.opening !== null
    )
      return
    await openFollowedChat(
      landing,
      { threadId, workflowId: landing.workflowId, source: 'list' },
      () => isCurrent(landing)
    )
  }

  function retireFollow(): void {
    dispatch({ type: 'retired' })
  }

  function retryFollow(): void {
    const failed = state.value
    if (failed.status === 'following' && failed.list === 'failed')
      void showLanding(failed.workflow, failed)
  }

  function activeWorkflowChanged(workflow: ComfyWorkflow | null): void {
    const current = state.value
    if (current.status !== 'idle' && current.workflow.path !== workflow?.path)
      retireFollow()
  }

  function userEngagementChanged(engaged: boolean): void {
    if (engaged) dispatch({ type: 'abandoned' })
  }

  function isOpeningThread(id: string): boolean {
    return (
      state.value.status === 'following' && state.value.opening?.threadId === id
    )
  }

  function restoreChatWorkflow(
    workflowId: string | undefined,
    navigationCurrent: () => boolean
  ): Promise<boolean> | boolean {
    const followed = state.value
    if (
      followed.status !== 'following' ||
      followed.opening?.threadId !== deps.currentThreadId()
    )
      return deps.restoreThreadWorkflow(workflowId, navigationCurrent)
    deps.adoptWorkflowTarget(followed.workflow, followed.opening.workflowId)
    deps.adoptRestoredWorkflowTab(followed.opening.workflowId)
    return true
  }

  const landing = computed<FollowLanding | null>(() => {
    const followed = state.value
    if (
      followed.status !== 'following' ||
      followed.workflow.path !== deps.activeWorkflow()?.path
    )
      return null
    return describeLanding(
      followed,
      followed.workflowId === null ? [] : deps.chatsFor(followed.workflowId)
    )
  })

  const openingWorkflowName = computed(() =>
    state.value.status === 'following' &&
    state.value.opening !== null &&
    opensAutomatically(state.value.opening) &&
    state.value.workflow.path === deps.activeWorkflow()?.path
      ? state.value.workflow.filename
      : undefined
  )

  return {
    landing,
    openingWorkflowName,
    followTab,
    openChat,
    retireFollow,
    retryFollow,
    activeWorkflowChanged,
    userEngagementChanged,
    isOpeningThread,
    restoreChatWorkflow
  }
}
