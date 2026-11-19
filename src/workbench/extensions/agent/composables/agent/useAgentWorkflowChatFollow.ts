import { computed, shallowRef } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { CloudWorkflowRefreshOutcome } from '@/workbench/extensions/agent/composables/agent/useAgentWorkflowResolver'
import type { ThreadListing } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

type Opening = { threadId: string; workflowId: string }

type OpeningOutcome = 'settled' | 'failed'

type ListPhase = 'hidden' | 'loading' | 'failed'

type FollowState =
  | { status: 'idle'; generation: number }
  | {
      status: 'following'
      generation: number
      workflow: ComfyWorkflow
      list: ListPhase
      opening: Opening | null
    }

type FollowOperation = Pick<
  Extract<FollowState, { status: 'following' }>,
  'generation' | 'workflow'
>

export type FollowLanding = {
  workflowName: string
  status: 'loading' | 'failed'
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
      list: ListPhase
    }
  | { type: 'opening_started'; generation: number; opening: Opening }
  | { type: 'opening_failed'; generation: number }
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
  userEngaged: () => boolean
  hasBlankPendingSend: (workflow: ComfyWorkflow) => boolean
  cloudIdFor: (workflow: ComfyWorkflow) => string | undefined
  refreshCloudWorkflowListing: () => Promise<CloudWorkflowRefreshOutcome>
  refreshHistory: (
    uiTreatment?: 'error_overlay' | 'none',
    workflowId?: string
  ) => Promise<ThreadListing['status'] | 'superseded'>
  loadThread: (
    threadId: string,
    isCurrent: () => boolean,
    options: { keepOpenChatUntilLoaded: boolean }
  ) => Promise<boolean>
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
        list: 'hidden',
        opening: null
      }
}

function listChangedState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'list_changed' }>
): FollowState {
  if (state.status !== 'following' || state.generation !== event.generation)
    return state
  return { ...state, list: event.list }
}

function openingStartedState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'opening_started' }>
): FollowState {
  if (state.status !== 'following' || state.generation !== event.generation)
    return state
  return { ...state, opening: event.opening }
}

function openingFailedState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'opening_failed' }>
): FollowState {
  if (state.status !== 'following' || state.generation !== event.generation)
    return state
  return { ...state, opening: null }
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
  if (state.status !== 'following') return state
  if (state.list === 'failed' && state.opening === null) return state
  return { status: 'idle', generation: state.generation + 1 }
}

function describeLanding(
  followed: Extract<FollowState, { status: 'following' }>
): FollowLanding | null {
  if (followed.list === 'hidden' || followed.opening !== null) return null
  return {
    workflowName: followed.workflow.filename,
    status: followed.list
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
    return !deps.followsVisibleWorkflow() && target?.path === workflow.path
  }

  function isCurrent(operation: FollowOperation): boolean {
    return (
      state.value.generation === operation.generation &&
      deps.activeWorkflow()?.path === operation.workflow.path
    )
  }

  function canOpen(
    operation: FollowOperation,
    ignoreDraftGate = false
  ): boolean {
    if (!isCurrent(operation) || deps.currentThreadId() !== null) return false
    return ignoreDraftGate || !deps.userEngaged()
  }

  function isOpeningWanted(
    operation: FollowOperation,
    threadId: string,
    ignoreDraftGate = false
  ): boolean {
    if (!isCurrent(operation)) return false
    const activeThreadId = deps.currentThreadId()
    if (activeThreadId === threadId) return true
    return activeThreadId === null && (ignoreDraftGate || !deps.userEngaged())
  }

  function isUnsavedTabWithoutBinding(workflow: ComfyWorkflow): boolean {
    return workflow.isTemporary && deps.cloudIdFor(workflow) === undefined
  }

  async function lookUpWorkflow(
    workflow: ComfyWorkflow
  ): Promise<WorkflowLookup> {
    const existing = deps.cloudIdFor(workflow)
    if (existing !== undefined) return { status: 'found', workflowId: existing }
    const listing = await deps.refreshCloudWorkflowListing()
    const refreshed = deps.cloudIdFor(workflow)
    if (refreshed !== undefined)
      return { status: 'found', workflowId: refreshed }
    return { status: listing === 'complete' ? 'none' : 'unknown' }
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
        generation: operation.generation
      })
      return 'failed'
    }
    dispatch({ type: 'opening_done', generation: operation.generation })
    deps.trackThreadStarted()
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

  function showList(operation: FollowOperation, list: ListPhase): void {
    dispatch({
      type: 'list_changed',
      generation: operation.generation,
      list
    })
  }

  function nextCandidateChat(
    workflowId: string,
    failedThreadId?: string
  ): ChatSession | undefined {
    return deps.chatsFor(workflowId).find((chat) => chat.id !== failedThreadId)
  }

  async function openLatestChat(
    operation: FollowOperation,
    workflowId: string,
    threadId: string,
    ignoreDraftGate = false
  ): Promise<void> {
    const outcome = await openFollowedChat(
      operation,
      { threadId, workflowId },
      () => isOpeningWanted(operation, threadId, ignoreDraftGate)
    )
    if (outcome === 'failed') showList(operation, 'failed')
  }

  async function landOnKnownChats(
    operation: FollowOperation,
    workflowId: string,
    failedThreadId?: string,
    ignoreDraftGate = false
  ): Promise<void> {
    const candidate = nextCandidateChat(workflowId, failedThreadId)
    if (candidate === undefined)
      return landOnFreshChats(
        operation,
        workflowId,
        failedThreadId,
        ignoreDraftGate
      )
    if (!canOpen(operation, ignoreDraftGate)) {
      retireIfCurrent(operation)
      return
    }
    void deps.refreshHistory('none', workflowId)
    await openLatestChat(operation, workflowId, candidate.id, ignoreDraftGate)
  }

  function retireIfCurrent(operation: FollowOperation): void {
    if (isCurrent(operation)) dispatch({ type: 'retired' })
  }

  async function landOnFreshChats(
    operation: FollowOperation,
    workflowId: string,
    failedThreadId?: string,
    ignoreDraftGate = false
  ): Promise<void> {
    showList(operation, 'loading')
    const outcome = await deps.refreshHistory('none', workflowId)
    if (!isCurrent(operation)) return
    if (outcome !== 'complete') {
      const candidate = nextCandidateChat(workflowId, failedThreadId)
      if (candidate !== undefined && canOpen(operation, ignoreDraftGate)) {
        await openLatestChat(
          operation,
          workflowId,
          candidate.id,
          ignoreDraftGate
        )
        return
      }
      showList(operation, 'failed')
      return
    }
    if (deps.chatsFor(workflowId).length === 0) {
      dispatch({ type: 'opening_done', generation: operation.generation })
      return
    }
    const candidate = nextCandidateChat(workflowId, failedThreadId)
    if (candidate === undefined) return showList(operation, 'failed')
    if (!canOpen(operation, ignoreDraftGate)) {
      retireIfCurrent(operation)
      return
    }
    await openLatestChat(operation, workflowId, candidate.id, ignoreDraftGate)
  }

  function hasImmediateBlankLanding(workflow: ComfyWorkflow): boolean {
    return (
      isUnsavedTabWithoutBinding(workflow) || deps.hasBlankPendingSend(workflow)
    )
  }

  async function showLanding(
    workflow: ComfyWorkflow,
    operation: FollowOperation,
    failedThreadId?: string,
    ignoreDraftGate = false
  ): Promise<void> {
    if (!canOpen(operation, ignoreDraftGate)) {
      retireIfCurrent(operation)
      return
    }
    if (hasImmediateBlankLanding(workflow)) {
      dispatch({ type: 'opening_done', generation: operation.generation })
      return
    }
    let workflowId = deps.cloudIdFor(workflow)
    if (workflowId === undefined) {
      showList(operation, 'loading')
      const lookup = await lookUpWorkflow(workflow)
      if (!isCurrent(operation)) return
      if (lookup.status === 'none') {
        dispatch({ type: 'opening_done', generation: operation.generation })
        return
      }
      if (lookup.status === 'unknown') return showList(operation, 'failed')
      workflowId = lookup.workflowId
    }
    if (deps.chatsFor(workflowId).length > 0)
      return landOnKnownChats(
        operation,
        workflowId,
        failedThreadId,
        ignoreDraftGate
      )
    await landOnFreshChats(
      operation,
      workflowId,
      failedThreadId,
      ignoreDraftGate
    )
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
    deps.showBlankChat()
    let failedThreadId: string | undefined
    if (remembered !== undefined && canOpen(operation)) {
      const outcome = await openFollowedChat(operation, remembered, () =>
        isOpeningWanted(operation, remembered.threadId)
      )
      if (outcome === 'settled') return
      deps.forgetOpenChat(remembered.threadId)
      failedThreadId = remembered.threadId
    }
    if (isCurrent(operation))
      await showLanding(workflow, operation, failedThreadId)
  }

  function retireFollow(): void {
    dispatch({ type: 'retired' })
  }

  function retryFollow(): void {
    const failed = state.value
    if (failed.status === 'following' && failed.list === 'failed')
      void showLanding(failed.workflow, failed, undefined, true)
  }

  function activeWorkflowChanged(workflow: ComfyWorkflow | null): void {
    const current = state.value
    if (current.status !== 'idle' && current.workflow.path !== workflow?.path)
      retireFollow()
  }

  function userEngagementChanged(engaged: boolean): void {
    if (!engaged) return
    const followed = state.value
    const opening = followed.status === 'following' ? followed.opening : null
    if (opening?.threadId === deps.currentThreadId()) return
    dispatch({ type: 'abandoned' })
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
    return describeLanding(followed)
  })

  const openingWorkflowName = computed(() =>
    state.value.status === 'following' &&
    state.value.opening !== null &&
    state.value.workflow.path === deps.activeWorkflow()?.path
      ? state.value.workflow.filename
      : undefined
  )

  return {
    landing,
    openingWorkflowName,
    followTab,
    retireFollow,
    retryFollow,
    activeWorkflowChanged,
    userEngagementChanged,
    isOpeningThread,
    restoreChatWorkflow
  }
}
