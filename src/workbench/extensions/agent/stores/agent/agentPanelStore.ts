import { useEventListener, useLocalStorage, useWindowSize } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import { defineStore } from 'pinia'
import {
  computed,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
  toRaw,
  watch
} from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  SIDEBAR_MIN_WIDTH,
  SIDE_TOOLBAR_WIDTH
} from '@/constants/splitterConstants'
import { useTelemetry } from '@comfyorg/telemetry'
import type {
  AgentPanelCloseSource,
  AgentPanelOpenedMetadata
} from '@comfyorg/telemetry/types'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import type { AgentServerFeature } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import type {
  CreditTransitionNoticeEvent,
  CreditTransitionNoticeState
} from './creditTransitionNoticeState'
import { reduceCreditTransitionNotice } from './creditTransitionNoticeState'

const PANEL_MIN_WIDTH = 420
const PANEL_MAX_WIDTH = 960
const FUNDS_RECHECK_TIMEOUT_MS = 10_000
const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'
const DISCOVERED_STORAGE_KEY = 'Comfy.AgentPanel.discovered'

type TargetTracking =
  | { mode: 'uninitialized' }
  | { mode: 'following' }
  | { mode: 'restoring' }
  | { mode: 'retained'; workflow: ComfyWorkflow }
  | {
      mode: 'retained'
      workflow: null
      closedPath?: never
      unavailable?: never
    }
  | {
      mode: 'retained'
      workflow: null
      closedPath: string
      unavailable?: never
    }
  | {
      mode: 'retained'
      workflow: null
      closedPath?: never
      unavailable: true
    }

export type AgentPanelView =
  | { screen: 'chat' }
  | {
      screen: 'history'
      previousThreadId: string | null
      selection:
        | { status: 'idle' }
        | { status: 'loading' | 'failed'; id: string }
    }

export const useAgentPanelStore = defineStore('agentPanel', () => {
  const enabled = ref(false)
  const consentAccepted = ref(false)
  const isOpen = useLocalStorage(OPEN_STORAGE_KEY, false, {
    writeDefaults: false
  })
  /** Whether the panel has ever been shown to this user, on any visit. */
  const hasEverOpened = useLocalStorage(DISCOVERED_STORAGE_KEY, false, {
    writeDefaults: false
  })
  const gateSettled = ref(false)
  /** The gate holding a send back from the turn POST, if one is. */
  const heldSendGate = ref<'consent' | 'coach' | null>(null)
  const view = shallowRef<AgentPanelView>({ screen: 'chat' })
  const { flags: featureFlags } = useFeatureFlags()
  const flagsSettled = computed(() => api.serverFeatureFlagsSettled.value)
  /** The server's `agent` feature; undefined unless its state is known. */
  const comfyAgent = computed(() => {
    if (import.meta.env.VITE_AGENT_STANDALONE === 'true') return undefined
    const agent = featureFlags.agent
    return agent?.state === 'starting' ||
      agent?.state === 'ready' ||
      agent?.state === 'failed'
      ? (agent as AgentServerFeature)
      : undefined
  })
  const maximized = ref(false)
  const draggedWidth = ref(PANEL_MIN_WIDTH)
  const reservedWorkspaceWidth = ref(SIDE_TOOLBAR_WIDTH + SIDEBAR_MIN_WIDTH)
  const reportedExhaustionIdentity = ref<string | null>(null)
  const billingRefreshedAcceptances = ref(0)
  const reportedFreeUseExposure = ref(false)
  const reportedFreeUseImpression = ref(false)
  const reportedCreditUsageExposure = ref(false)
  const fundsRechecks = ref(new Map<number, string>())
  const fundsRecheckTimeouts = new Map<number, ReturnType<typeof setTimeout>>()
  const fundsRecheckFinished = new Map<number, () => void>()
  let nextFundsRecheckId = 0
  const creditTransitionNotice = shallowRef<CreditTransitionNoticeState | null>(
    null
  )
  const dismissedSelectionSignature = ref<string | null>(null)
  const workflowStore = useWorkflowStore()
  const targetTracking = ref<TargetTracking>({ mode: 'uninitialized' })
  const followsVisibleWorkflow = computed(
    () => targetTracking.value.mode === 'following'
  )
  const selectedWorkflow = computed(() => {
    const target = targetTracking.value
    if (target.mode === 'following') return workflowStore.activeWorkflow
    return target.mode === 'retained' ? target.workflow : null
  })
  const targetUnavailable = computed(
    () =>
      targetTracking.value.mode === 'retained' &&
      targetTracking.value.workflow === null &&
      targetTracking.value.unavailable === true
  )
  const canRestoreWorkflow = computed(
    () => targetTracking.value.mode === 'restoring'
  )

  function beginWorkflowRestoration(): void {
    targetTracking.value = { mode: 'restoring' }
  }

  function interruptHistorySelection(): void {
    if (
      view.value.screen === 'history' &&
      view.value.selection.status === 'loading'
    )
      view.value = {
        ...view.value,
        selection: { status: 'failed', id: view.value.selection.id }
      }
  }

  function initializeTargetTracking(hasThread: boolean): void {
    if (targetTracking.value.mode !== 'uninitialized') return
    targetTracking.value = { mode: hasThread ? 'restoring' : 'following' }
  }

  function retainWorkflowTarget(): void {
    if (targetTracking.value.mode === 'retained') return
    setWorkflowTarget(selectedWorkflow.value)
  }

  function startFollowingVisibleWorkflow(): void {
    targetTracking.value = { mode: 'following' }
  }

  function setWorkflowTarget(workflow: ComfyWorkflow | null): void {
    targetTracking.value =
      workflow === null
        ? { mode: 'retained', workflow: null }
        : { mode: 'retained', workflow }
  }

  function markWorkflowTargetUnavailable(): void {
    targetTracking.value = {
      mode: 'retained',
      workflow: null,
      unavailable: true
    }
  }

  function detachClosedTarget(workflow: ComfyWorkflow): void {
    targetTracking.value = workflow.isTemporary
      ? { mode: 'retained', workflow: null }
      : { mode: 'retained', workflow: null, closedPath: workflow.path }
  }

  watch(
    () => [targetTracking.value, ...workflowStore.openWorkflows],
    () => {
      const target = targetTracking.value
      if (target.mode !== 'retained') return
      if (target.workflow !== null) {
        if (!workflowStore.openWorkflows.includes(target.workflow))
          detachClosedTarget(target.workflow)
      } else if (
        workflowStore.openWorkflows.some(
          ({ path }) => path === target.closedPath
        )
      )
        setWorkflowTarget(null)
    }
  )

  function isRetainedTarget(workflow: ComfyWorkflow): boolean {
    const target = targetTracking.value
    if (target.mode !== 'retained') return false
    return target.workflow === null
      ? target.closedPath === workflow.path
      : toRaw(target.workflow) === toRaw(workflow)
  }

  function followClosedTargetRename(oldPath: string, newPath: string): void {
    const target = targetTracking.value
    if (
      target.mode === 'retained' &&
      target.workflow === null &&
      target.closedPath === oldPath
    )
      targetTracking.value = {
        mode: 'retained',
        workflow: null,
        closedPath: newPath
      }
  }

  workflowStore.$onAction(({ name, args, after }) => {
    if (name === 'deleteWorkflow') {
      const [workflow] = args
      if (!workflow.isTemporary)
        after(() => {
          if (isRetainedTarget(workflow)) markWorkflowTargetUnavailable()
        })
    } else if (name === 'renameWorkflow') {
      const [workflow] = args
      const oldPath = workflow.path
      after(() => followClosedTargetRename(oldPath, workflow.path))
    }
  })

  let openedAt: number | null = null
  let teardownReported = false

  function startOpenEpoch(): void {
    openedAt = Date.now()
    teardownReported = false
    reportedFreeUseExposure.value = false
    reportedFreeUseImpression.value = false
    reportedCreditUsageExposure.value = false
  }

  const isVisible = computed(() => enabled.value && isOpen.value)

  watch(isVisible, (visible) => {
    if (!visible) {
      openedAt = null
      return
    }
    hasEverOpened.value = true
    if (openedAt !== null) return
    startOpenEpoch()
    useTelemetry()?.trackAgentPanelOpened({ source: 'restored' })
  })

  const { width: windowWidth } = useWindowSize()

  const maxWidth = computed(() =>
    clamp(windowWidth.value - reservedWorkspaceWidth.value, 0, PANEL_MAX_WIDTH)
  )

  /**
   * The rendered width. Narrowing the window clamps it; widening restores the
   * width the user asked for, so a maximized panel never leaves the viewport.
   */
  const width = computed(() =>
    Math.min(
      maxWidth.value,
      maximized.value ? PANEL_MAX_WIDTH : draggedWidth.value
    )
  )
  const requestedWidth = computed(() =>
    maximized.value ? PANEL_MAX_WIDTH : draggedWidth.value
  )
  const isOverlay = computed(
    () =>
      windowWidth.value <= requestedWidth.value + reservedWorkspaceWidth.value
  )

  const isMaximized = computed(() => maximized.value)

  function open(
    source: AgentPanelOpenedMetadata['source'] = 'topbar_button'
  ): void {
    if (isOpen.value) return
    isOpen.value = true
    startOpenEpoch()
    useTelemetry()?.trackAgentPanelOpened({ source })
  }

  function close(source: AgentPanelCloseSource): void {
    if (!isOpen.value) return
    isOpen.value = false
    const openDurationMs = openedAt === null ? null : Date.now() - openedAt
    openedAt = null
    useTelemetry()?.trackAgentPanelClosed({
      source,
      open_duration_ms: openDurationMs
    })
  }

  function suppressRestoredOpen(): void {
    if (!isOpen.value || isVisible.value) return
    isOpen.value = false
    openedAt = null
  }

  useEventListener(window, 'pagehide', () => {
    if (!isVisible.value || openedAt === null || teardownReported) return
    teardownReported = true
    useTelemetry()?.trackAgentPanelClosed({
      source: 'pagehide',
      open_duration_ms: Date.now() - openedAt
    })
  })

  useEventListener(window, 'pageshow', (event: PageTransitionEvent) => {
    if (!event.persisted || !isVisible.value) return
    openedAt = Date.now()
    teardownReported = false
  })

  function toggle(): void {
    if (isOpen.value) close('topbar_button')
    else open()
  }

  function setReservedWorkspaceWidth(px: number): void {
    reservedWorkspaceWidth.value = Math.max(0, px)
  }

  function setWidth(px: number): void {
    maximized.value = false
    draggedWidth.value = clamp(px, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH)
  }

  function toggleMaximize(): void {
    maximized.value = !maximized.value
    if (!maximized.value) draggedWidth.value = PANEL_MIN_WIDTH
  }

  function dispatchCreditTransitionNotice(
    event: CreditTransitionNoticeEvent
  ): boolean {
    const before = creditTransitionNotice.value
    creditTransitionNotice.value = reduceCreditTransitionNotice(before, event)
    return creditTransitionNotice.value !== before
  }

  function observeAgentScopedFunds(
    identity: string,
    scopedHasFunds: boolean
  ): void {
    dispatchCreditTransitionNotice({
      type: 'scopedRead',
      identity,
      scopedHasFunds
    })
  }

  function claimCreditTransitionNoticeImpression(identity: string): boolean {
    return dispatchCreditTransitionNotice({
      type: 'shown',
      identity
    })
  }

  function dismissCreditTransitionNotice(identity: string): void {
    dispatchCreditTransitionNotice({ type: 'dismissed', identity })
  }

  function beginFundsRecheck(
    identity: string,
    onFinished?: () => void
  ): number {
    const id = ++nextFundsRecheckId
    fundsRechecks.value.set(id, identity)
    if (onFinished) fundsRecheckFinished.set(id, onFinished)
    fundsRecheckTimeouts.set(
      id,
      setTimeout(() => finishFundsRecheck(id), FUNDS_RECHECK_TIMEOUT_MS)
    )
    return id
  }

  function finishFundsRecheck(id: number): void {
    clearTimeout(fundsRecheckTimeouts.get(id))
    fundsRecheckTimeouts.delete(id)
    fundsRechecks.value.delete(id)
    fundsRecheckFinished.get(id)?.()
    fundsRecheckFinished.delete(id)
  }

  function cancelFundsRechecks(): void {
    for (const id of fundsRechecks.value.keys()) finishFundsRecheck(id)
  }

  function hasPendingFundsRecheck(identity: string): boolean {
    return [...fundsRechecks.value.values()].includes(identity)
  }

  onScopeDispose(cancelFundsRechecks)

  return {
    enabled,
    consentAccepted,
    isOpen,
    isVisible,
    hasEverOpened,
    gateSettled,
    heldSendGate,
    view,
    interruptHistorySelection,
    flagsSettled,
    comfyAgent,
    reportedExhaustionIdentity,
    billingRefreshedAcceptances,
    reportedFreeUseExposure,
    reportedFreeUseImpression,
    reportedCreditUsageExposure,
    creditTransitionNotice: readonly(creditTransitionNotice),
    observeAgentScopedFunds,
    claimCreditTransitionNoticeImpression,
    dismissCreditTransitionNotice,
    beginFundsRecheck,
    finishFundsRecheck,
    cancelFundsRechecks,
    hasPendingFundsRecheck,
    width,
    requestedWidth,
    isOverlay,
    isMaximized,
    dismissedSelectionSignature,
    open,
    targetTracking,
    followsVisibleWorkflow,
    initializeTargetTracking,
    retainWorkflowTarget,
    startFollowingVisibleWorkflow,
    selectedWorkflow,
    targetUnavailable,
    markWorkflowTargetUnavailable,
    canRestoreWorkflow,
    beginWorkflowRestoration,
    setWorkflowTarget,
    toggle,
    close,
    suppressRestoredOpen,
    setWidth,
    setReservedWorkspaceWidth,
    toggleMaximize
  }
})
