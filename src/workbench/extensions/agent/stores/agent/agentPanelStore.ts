import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

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
  const width = ref(PANEL_MIN_WIDTH)
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
    useTelemetry()?.trackAgentPanelOpened({ source: 'restored' })
  })

  const isMaximized = computed(() => width.value === PANEL_MAX_WIDTH)

  function open(
    source: AgentPanelOpenedMetadata['source'] = 'topbar_button'
  ): void {
    if (isOpen.value) return
    isOpen.value = true
    openedAt = Date.now()
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

  function toggle(): void {
    if (isOpen.value) close('topbar_button')
    else open()
  }

  function setWidth(px: number): void {
    width.value = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, px))
  }

  function toggleMaximize(): void {
    setWidth(isMaximized.value ? PANEL_MIN_WIDTH : PANEL_MAX_WIDTH)
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
    toggleMaximize
  }
})
