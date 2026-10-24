import { maxBy } from 'es-toolkit'
import { computed, shallowRef } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ThreadListing } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

type FollowOperation = {
  status: 'loading'
  generation: number
  workflow: ComfyWorkflow
  chat: { threadId: string; workflowId: string } | null
}

type FollowState =
  | { status: 'idle'; generation: number }
  | FollowOperation
  | { status: 'failed'; generation: number; workflow: ComfyWorkflow }

type FollowEvent =
  | { type: 'requested'; workflow: ComfyWorkflow; heldBack: boolean }
  | {
      type: 'chat_found'
      generation: number
      threadId: string
      workflowId: string
    }
  | { type: 'failed'; generation: number; workflow: ComfyWorkflow }
  | { type: 'finished'; generation: number }
  | { type: 'retired' }

type FollowDeps = {
  activeWorkflow: () => ComfyWorkflow | null
  selectedTarget: () => ComfyWorkflow | null
  currentThreadId: () => string | null
  sessions: () => ChatSession[]
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
        status: 'loading',
        generation,
        workflow: event.workflow,
        chat: null
      }
}

function chatFoundState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'chat_found' }>
): FollowState {
  if (state.status !== 'loading' || state.generation !== event.generation)
    return state
  return {
    ...state,
    chat: { threadId: event.threadId, workflowId: event.workflowId }
  }
}

function failedState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'failed' }>
): FollowState {
  if (state.status !== 'loading' || state.generation !== event.generation)
    return state
  return {
    status: 'failed',
    generation: event.generation,
    workflow: event.workflow
  }
}

function finishedState(
  state: FollowState,
  event: Extract<FollowEvent, { type: 'finished' }>
): FollowState {
  return state.status === 'loading' && state.generation === event.generation
    ? { status: 'idle', generation: state.generation }
    : state
}

function reduceFollow(state: FollowState, event: FollowEvent): FollowState {
  switch (event.type) {
    case 'requested':
      return requestedState(state, event)
    case 'chat_found':
      return chatFoundState(state, event)
    case 'failed':
      return failedState(state, event)
    case 'finished':
      return finishedState(state, event)
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
    return workflow.isTemporary || deps.userEngaged() || chatTargetsWorkflow
  }

  function latestChatFor(workflowId: string): string | undefined {
    return maxBy(
      deps.sessions().filter((session) => session.workflowId === workflowId),
      ({ lastActivityAt }) => lastActivityAt ?? Number.NEGATIVE_INFINITY
    )?.id
  }

  function isCurrent(operation: FollowOperation): boolean {
    return (
      state.value.generation === operation.generation &&
      deps.activeWorkflow()?.path === operation.workflow.path &&
      !deps.userEngaged()
    )
  }

  async function openFollowedChat(
    id: string,
    operation: FollowOperation,
    workflowId: string
  ): Promise<void> {
    dispatch({
      type: 'chat_found',
      generation: operation.generation,
      threadId: id,
      workflowId
    })
    const opened = await deps.loadThread(id, () => isCurrent(operation), {
      keepOpenChatUntilLoaded: true
    })
    if (!isCurrent(operation)) return
    if (!opened) {
      dispatch({
        type: 'failed',
        generation: operation.generation,
        workflow: operation.workflow
      })
      return
    }
    dispatch({ type: 'finished', generation: operation.generation })
    if (!deps.hasDraft()) deps.clearDraft()
    deps.trackThreadStarted()
  }

  async function resolveWorkflowId(
    workflow: ComfyWorkflow
  ): Promise<string | undefined> {
    const existing = deps.cloudIdFor(workflow)
    if (existing !== undefined) return existing
    await deps.refreshCloudWorkflowIds()
    return deps.cloudIdFor(workflow)
  }

  async function refreshForFollow(
    workflowId: string,
    operation: FollowOperation
  ): Promise<boolean> {
    const outcome = await deps.refreshHistory('none', workflowId)
    if (!isCurrent(operation)) return false
    if (outcome === 'failed' || outcome === 'incomplete') {
      dispatch({
        type: 'failed',
        generation: operation.generation,
        workflow: operation.workflow
      })
      return false
    }
    return outcome === 'complete'
  }

  async function openLatestChat(
    workflowId: string,
    operation: FollowOperation
  ): Promise<void> {
    const latest = latestChatFor(workflowId)
    if (latest !== undefined && latest !== deps.currentThreadId())
      await openFollowedChat(latest, operation, workflowId)
  }

  async function followTab(workflow: ComfyWorkflow): Promise<void> {
    dispatch({ type: 'requested', workflow, heldBack: heldBack(workflow) })
    const operation = state.value
    if (operation.status !== 'loading') return
    try {
      const workflowId = await resolveWorkflowId(workflow)
      if (workflowId === undefined || !isCurrent(operation)) return
      if (
        !(await refreshForFollow(workflowId, operation)) ||
        !isCurrent(operation)
      )
        return
      await openLatestChat(workflowId, operation)
    } finally {
      dispatch({ type: 'finished', generation: operation.generation })
    }
  }

  function retireFollow(): void {
    dispatch({ type: 'retired' })
  }

  function retryFollow(): void {
    const failed = state.value
    if (failed.status === 'failed') void followTab(failed.workflow)
  }

  function activeWorkflowChanged(workflow: ComfyWorkflow | null): void {
    const current = state.value
    if (
      current.status !== 'idle' &&
      (current.status === 'failed' || current.workflow.path !== workflow?.path)
    )
      retireFollow()
  }

  function userEngagementChanged(engaged: boolean): void {
    if (engaged) retireFollow()
  }

  function isOpeningThread(id: string): boolean {
    return state.value.status === 'loading' && state.value.chat?.threadId === id
  }

  function restoreChatWorkflow(
    workflowId: string | undefined,
    navigationCurrent: () => boolean
  ): Promise<boolean> | boolean {
    const followed = state.value
    if (
      followed.status !== 'loading' ||
      followed.chat?.threadId !== deps.currentThreadId()
    )
      return deps.restoreThreadWorkflow(workflowId, navigationCurrent)
    deps.adoptWorkflowTarget(followed.workflow, followed.chat.workflowId)
    deps.adoptRestoredWorkflowTab(followed.chat.workflowId)
    return true
  }

  const failure = computed(() =>
    state.value.status === 'failed' ? state.value.workflow : null
  )
  const openingWorkflowName = computed(() =>
    state.value.status === 'loading' &&
    state.value.workflow.path === deps.activeWorkflow()?.path
      ? state.value.workflow.filename
      : undefined
  )

  return {
    failure,
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
