import { useEventListener, useLocalStorage, useWindowSize } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import {
  SIDEBAR_MIN_WIDTH,
  SIDE_TOOLBAR_WIDTH
} from '@/constants/splitterConstants'
import { useTelemetry } from '@/platform/telemetry'
import type {
  AgentPanelCloseSource,
  AgentPanelOpenedMetadata
} from '@/platform/telemetry/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

const PANEL_MIN_WIDTH = 420
const PANEL_MAX_WIDTH = 960
const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'
const DISCOVERED_STORAGE_KEY = 'Comfy.AgentPanel.discovered'

type TargetTracking =
  | { mode: 'uninitialized' }
  | { mode: 'following' }
  | { mode: 'restoring' }
  | { mode: 'retained'; workflow: ComfyWorkflow | null }

export const useAgentPanelStore = defineStore('agentPanel', () => {
  const enabled = ref(false)
  const consentAccepted = ref(false)
  // writeDefaults false: no storage key planted for flag-off users.
  const isOpen = useLocalStorage(OPEN_STORAGE_KEY, false, {
    writeDefaults: false
  })
  /** Whether the panel has ever been shown to this user, on any visit. */
  const hasEverOpened = useLocalStorage(DISCOVERED_STORAGE_KEY, false, {
    writeDefaults: false
  })
  const gateSettled = ref(false)
  const maximized = ref(false)
  const draggedWidth = ref(PANEL_MIN_WIDTH)
  /**
   * Width the workspace left of the panel needs: the side toolbar, plus the
   * sidebar when one is open. The layout that owns those keeps it current, so
   * the panel gives way the moment it would meet the sidebar.
   */
  const reservedWorkspaceWidth = ref(SIDE_TOOLBAR_WIDTH + SIDEBAR_MIN_WIDTH)
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
  const canRestoreWorkflow = computed(
    () => targetTracking.value.mode === 'restoring'
  )

  function beginWorkflowRestoration(): void {
    targetTracking.value = { mode: 'restoring' }
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
    targetTracking.value = { mode: 'retained', workflow }
  }

  // Only a retained target can become detached. A following target belongs to
  // the editor, including its replacement when the visible tab closes.
  watch(
    () => [targetTracking.value, ...workflowStore.openWorkflows],
    () => {
      const target = targetTracking.value
      if (
        target.mode === 'retained' &&
        target.workflow !== null &&
        !workflowStore.openWorkflows.includes(target.workflow)
      )
        setWorkflowTarget(null)
    }
  )

  let openedAt: number | null = null
  // Guards the pagehide teardown report below: true once this open epoch has
  // reported a close, so a bfcache-frozen page that fires pagehide again
  // (background/resume/close) can't emit a second overlapping duration for
  // the same openedAt. A fresh epoch (open(), or the watcher below) resets it.
  let teardownReported = false

  const isVisible = computed(
    () => enabled.value && isOpen.value && consentAccepted.value
  )

  watch(isVisible, (visible) => {
    if (!visible) {
      openedAt = null
      return
    }
    hasEverOpened.value = true
    if (openedAt !== null) return
    openedAt = Date.now()
    teardownReported = false
    useTelemetry()?.trackAgentPanelOpened({ source: 'restored' })
  })

  const { width: windowWidth } = useWindowSize()

  /**
   * Falls below `PANEL_MIN_WIDTH` when the window leaves less room than that.
   * A panel narrower than its minimum still beats one that leaves the window.
   */
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

  const isMaximized = computed(() => maximized.value)

  function open(
    source: AgentPanelOpenedMetadata['source'] = 'topbar_button'
  ): void {
    if (isOpen.value) return
    isOpen.value = true
    openedAt = Date.now()
    teardownReported = false
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

  // pagehide is the reliable teardown signal on tab close/reload and even on
  // some mobile Safari backgrounding, where nothing else is guaranteed to
  // fire again. Reports the open duration without mutating isOpen/local
  // storage, so the localStorage-backed restore-on-reload behaviour
  // (FE-1284/PM-648) is untouched.
  useEventListener(window, 'pagehide', () => {
    if (!isVisible.value || openedAt === null || teardownReported) return
    teardownReported = true
    useTelemetry()?.trackAgentPanelClosed({
      source: 'pagehide',
      open_duration_ms: Date.now() - openedAt
    })
  })

  // A bfcache restore resumes this same frozen interval rather than starting
  // a new one, so the pagehide report above already closed it out. Starting
  // a fresh interval here keeps a later close()/pagehide measuring only the
  // time since resume, instead of re-including (and double counting) the
  // span already reported.
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

  return {
    enabled,
    consentAccepted,
    isOpen,
    isVisible,
    hasEverOpened,
    gateSettled,
    width,
    isMaximized,
    dismissedSelectionSignature,
    open,
    targetTracking,
    followsVisibleWorkflow,
    initializeTargetTracking,
    retainWorkflowTarget,
    startFollowingVisibleWorkflow,
    selectedWorkflow,
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
