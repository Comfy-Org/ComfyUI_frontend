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

export type TourPhase = 'idle' | 'active'
export type TourEndReason = 'done' | 'skip' | 'error'

export interface ResultMedia {
  url: string
  kind: MediaKind
}

/** How long to wait for the sink's output URL after a run before giving up. */
const RESULT_MEDIA_TIMEOUT_MS = 8000

export function isUpgradeModalOpen(): boolean {
  const dialogStore = useDialogStore()
  return UPGRADE_DIALOG_KEYS.some((key) => dialogStore.isDialogOpen(key))
}

/**
 * The graph nodes a single step points at: its own target, plus the prompt's
 * collapsed host (the subgraph is never entered, so its exposed port is the
 * spotlight target). Shared by the spotlight and reveal derivations so they
 * can't drift.
 */
function stepTargets(step: TourStep): NodeId[] {
  const ids: NodeId[] = []
  if (step.nodeId !== null) ids.push(step.nodeId)
  if (step.prompt) ids.push(step.prompt.subgraphNodeId)
  return ids
}

/**
 * Tour state: step position, resolved roles, the ordered step sequence, which
 * nodes are currently revealed, and the run/result of the user's first
 * generation. All litegraph reads happen through the canvas adapter, never here.
 */
export const useOnboardingTourStore = defineStore('onboardingTour', () => {
  const phase = ref<TourPhase>('idle')
  const stepIndex = ref(0)
  const steps = ref<TourStep[]>([])
  const resolvedRoles = ref<ResolvedRoles | null>(null)
  const revealedNodeIds = ref<Set<NodeId>>(new Set())
  const resultMedia = ref<ResultMedia | null>(null)
  /**
   * Set when the run reports any outcome (success, error, interrupt). The Result
   * step's "Generating…" hangs off this rather than off `resultMedia`, which only
   * lands if the sink yields a URL before its capture times out — a failed capture
   * must not read as generating forever.
   */
  const runFinished = ref(false)
  /**
   * Bumped once per `start()`. `start()` returns to idle and back to active in one
   * tick, so a watcher on `phase` never observes the gap and cannot tell a restart
   * from a step change; this gives it an edge it can see.
   */
  const tourRunId = ref(0)
  /** Drives the bottom-right nudge; outlives the tour so it can show after it ends. */
  const shouldShowNudge = ref(false)
  /** Set when `showNudge` defers because the upgrade modal is open; the modal-close watch drains it. */
  const nudgeArmed = ref(false)
  /** "Not now" latches this so no later trigger can resurface the nudge this session. */
  const nudgeDismissed = ref(false)

  const currentStep = computed<TourStep | null>(
    () => steps.value[stepIndex.value] ?? null
  )
  const totalSteps = computed(() => steps.value.length)

  /** Nodes the current step targets, spotlit brightly while prior reveals stay dim. */
  const spotlitNodeIds = computed<Set<NodeId>>(() => {
    const step = currentStep.value
    return step ? new Set(stepTargets(step)) : new Set()
  })

  /**
   * Reveal every node targeted by steps up to and including `stepIndex` so the
   * graph builds up — except the final Result step, which collapses back to just
   * the sink so the generated output is the sole focus.
   */
  function syncRevealed() {
    const step = currentStep.value
    if (step?.kind === 'result' && step.nodeId !== null) {
      revealedNodeIds.value = new Set([step.nodeId])
      return
    }
    const revealed = new Set<NodeId>()
    for (const prior of steps.value.slice(0, stepIndex.value + 1)) {
      for (const id of stepTargets(prior)) revealed.add(id)
    }
    revealedNodeIds.value = revealed
  }

  function start(workflow: ComfyWorkflowJSON, templateId?: string) {
    reset()
    resetNudge()
    const roles = resolveTourRoles(workflow, templateId)
    resolvedRoles.value = roles
    steps.value = sequenceBuilder(roles)
    tourRunId.value += 1
    phase.value = 'active'
    syncRevealed()
  }

  function advance() {
    if (stepIndex.value >= steps.value.length - 1) return
    stepIndex.value += 1
    syncRevealed()
  }

  function back() {
    if (stepIndex.value <= 0) return
    stepIndex.value -= 1
    syncRevealed()
  }

  /**
   * Record the sink's generated output as the Result step's media. The output URL
   * is not ready synchronously when the run finishes (the cloud queue refresh
   * fetches it just after), so wait for it to appear rather than dropping the
   * first run. The media kind comes from the resolved sink, not the output MIME,
   * so a restored-from-URL result still picks the right renderer. Idempotent and
   * bails if the tour ends mid-wait.
   */
  async function captureResultMedia() {
    if (phase.value !== 'active' || resultMedia.value) return
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
    if (!url || phase.value !== 'active') return

    resultMedia.value = { url, kind: resolvedRoles.value?.mediaKind ?? 'image' }
  }

  /**
   * Surface the bottom-right nudge once the tour ends — on every outcome. If the
   * upgrade modal is open, defer instead (arm it) so the two never overlap; the
   * modal-close watch re-runs this once the modal clears. Dismissal wins over both.
   */
  function showNudge() {
    if (nudgeDismissed.value) return
    if (isUpgradeModalOpen()) {
      nudgeArmed.value = true
      return
    }
    nudgeArmed.value = false
    shouldShowNudge.value = true
  }

  /** "Not now": hide the nudge and block any later trigger this session. */
  function dismissNudge() {
    shouldShowNudge.value = false
    nudgeDismissed.value = true
  }

  /** Nudge state outlives the tour, so only a fresh tour clears it. */
  function resetNudge() {
    shouldShowNudge.value = false
    nudgeArmed.value = false
    nudgeDismissed.value = false
    resultMedia.value = null
    runFinished.value = false
  }

  function reset() {
    phase.value = 'idle'
    stepIndex.value = 0
    steps.value = []
    resolvedRoles.value = null
    revealedNodeIds.value = new Set()
  }

  function end() {
    restoreView()
    reset()
  }

  return {
    phase,
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
    start,
    advance,
    back,
    captureResultMedia,
    showNudge,
    dismissNudge,
    end,
    reset
  }
})
