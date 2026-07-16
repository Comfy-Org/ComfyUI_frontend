import { until } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { UPGRADE_DIALOG_KEYS } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useDialogStore } from '@/stores/dialogStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { NodeId } from '@/types/nodeId'
import { resolveNode } from '@/utils/litegraphUtil'

import { resolveTourRoles } from './roleResolution'
import { restoreView } from './subgraphNavigation'
import { sequenceBuilder } from './tourSequence'
import type { MediaKind, ResolvedRoles, TourStep } from './tourSequence'

export type TourEndReason = 'done' | 'skip' | 'error'

export interface ResultMedia {
  url: string
  kind: MediaKind
}

const RESULT_MEDIA_TIMEOUT_MS = 8000

export function isUpgradeModalOpen(): boolean {
  const dialogStore = useDialogStore()
  return UPGRADE_DIALOG_KEYS.some((key) => dialogStore.isDialogOpen(key))
}

/** A step's target node, plus the prompt's collapsed host (the subgraph is never entered). */
function stepTargets(step: TourStep): NodeId[] {
  const ids: NodeId[] = []
  if (step.nodeId !== null) ids.push(step.nodeId)
  if (step.prompt) ids.push(step.prompt.subgraphNodeId)
  return ids
}

/** First-run tour view state; the coachmark engine owns the sequence, the controller mirrors its position here. */
export const useFirstRunTourStore = defineStore('firstRunTour', () => {
  const isActive = ref(false)
  const stepIndex = ref(0)
  const steps = ref<TourStep[]>([])
  const resolvedRoles = ref<ResolvedRoles | null>(null)
  const resultMedia = ref<ResultMedia | null>(null)
  /** Set on any run outcome; drives "Generating…" so a timed-out capture doesn't spin forever. */
  const runFinished = ref(false)
  /** Bumped once per tour so the overlay can tell a restart from a step change. */
  const tourRunId = ref(0)
  const shouldShowNudge = ref(false)
  /** Set when `showNudge` defers behind the upgrade modal; the modal-close watch drains it. */
  const nudgeArmed = ref(false)
  /** "Not now" latches this so no later trigger resurfaces the nudge this session. */
  const nudgeDismissed = ref(false)

  const currentStep = computed<TourStep | null>(
    () => steps.value[stepIndex.value] ?? null
  )
  const totalSteps = computed(() => steps.value.length)

  const spotlitNodeIds = computed<Set<NodeId>>(() => {
    const step = currentStep.value
    return step ? new Set(stepTargets(step)) : new Set()
  })

  // Steps up to `stepIndex` accumulate — except Result, which collapses to just the sink.
  const revealedNodeIds = computed<Set<NodeId>>(() => {
    const step = currentStep.value
    if (step?.kind === 'result' && step.nodeId !== null) {
      return new Set([step.nodeId])
    }
    const revealed = new Set<NodeId>()
    for (const prior of steps.value.slice(0, stepIndex.value + 1)) {
      for (const id of stepTargets(prior)) revealed.add(id)
    }
    return revealed
  })

  function prepare(workflow: ComfyWorkflowJSON, templateId?: string) {
    resetNudge()
    stepIndex.value = 0
    const roles = resolveTourRoles(workflow, templateId)
    resolvedRoles.value = roles
    steps.value = sequenceBuilder(roles)
    tourRunId.value += 1
  }

  // The URL lands just after the run (the cloud queue refresh fetches it), so wait rather than drop it.
  async function captureResultMedia() {
    if (!isActive.value || resultMedia.value) return
    const sink = resolvedRoles.value?.sink
    if (!sink) return

    const sinkUrl = () => {
      const node = resolveNode(sink.nodeId)
      return node
        ? (useNodeOutputStore().getNodeImageUrls(node)?.[0] ?? '')
        : ''
    }

    const url = await until(sinkUrl).toMatch((value) => value.length > 0, {
      timeout: RESULT_MEDIA_TIMEOUT_MS,
      throwOnTimeout: false
    })
    if (!url || !isActive.value) return

    resultMedia.value = { url, kind: resolvedRoles.value?.mediaKind ?? 'image' }
  }

  // Defer behind the upgrade modal so the two never overlap; dismissal wins over both.
  function showNudge() {
    if (nudgeDismissed.value) return
    if (isUpgradeModalOpen()) {
      nudgeArmed.value = true
      return
    }
    nudgeArmed.value = false
    shouldShowNudge.value = true
  }

  function dismissNudge() {
    shouldShowNudge.value = false
    nudgeDismissed.value = true
  }

  // Nudge state outlives the tour, so only a fresh tour clears it.
  function resetNudge() {
    shouldShowNudge.value = false
    nudgeArmed.value = false
    nudgeDismissed.value = false
    resultMedia.value = null
    runFinished.value = false
  }

  function reset() {
    isActive.value = false
    stepIndex.value = 0
    steps.value = []
    resolvedRoles.value = null
  }

  function end() {
    restoreView()
    reset()
  }

  return {
    isActive,
    stepIndex,
    steps,
    currentStep,
    totalSteps,
    resolvedRoles,
    revealedNodeIds,
    spotlitNodeIds,
    resultMedia,
    runFinished,
    tourRunId,
    shouldShowNudge,
    nudgeArmed,
    prepare,
    captureResultMedia,
    showNudge,
    dismissNudge,
    end
  }
})
