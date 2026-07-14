import { until } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { NodeId } from '@/types/nodeId'
import { resolveNode } from '@/utils/litegraphUtil'

import { resolveRoles } from './roleResolver'
import type { NodeDefLookup } from './roleResolver'
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

/** Output types that mark a registry sink as producing video rather than an image. */
const VIDEO_OUTPUT_TYPES = new Set(['VIDEO', 'VHS_VIDEOINFO'])

/** Reads the node registry so the resolver can widen sink detection to custom output nodes. */
const nodeDefLookup: NodeDefLookup = (type) => {
  const defs = useNodeDefStore().nodeDefsByName
  if (!Object.hasOwn(defs, type)) return null
  const def = defs[type]
  return {
    isOutputNode: def.output_node,
    producesVideo: def.outputs.some((output) =>
      VIDEO_OUTPUT_TYPES.has(output.type)
    )
  }
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
  /** Set on the prompt step: the collapsed host's exposed prompt port is spotlit. */
  const promptPortFallback = ref(false)
  /** Drives the bottom-right nudge; outlives the tour so it can show after it ends. */
  const shouldShowNudge = ref(false)
  /** No-funds fallback: the gate arms this so the modal-close watch can surface the nudge. */
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
    const roles = resolveRoles(workflow, templateId, nodeDefLookup)
    resolvedRoles.value = roles
    steps.value = sequenceBuilder(roles)
    phase.value = 'active'
    syncRevealed()
  }

  function advance() {
    if (stepIndex.value >= steps.value.length - 1) return
    stepIndex.value += 1
    promptPortFallback.value = false
    syncRevealed()
  }

  function back() {
    if (stepIndex.value <= 0) return
    stepIndex.value -= 1
    promptPortFallback.value = false
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

  /** Arm the no-funds fallback so the modal-close watch can surface the nudge. */
  function armNudge() {
    nudgeArmed.value = true
  }

  /** Surface the bottom-right nudge, unless the user already dismissed it. */
  function showNudge() {
    // Consume the fallback arm so it fires at most once, regardless of dismissal.
    nudgeArmed.value = false
    if (nudgeDismissed.value) return
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
  }

  function reset() {
    phase.value = 'idle'
    stepIndex.value = 0
    steps.value = []
    resolvedRoles.value = null
    revealedNodeIds.value = new Set()
    resultMedia.value = null
    promptPortFallback.value = false
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
    promptPortFallback,
    shouldShowNudge,
    nudgeArmed,
    start,
    advance,
    back,
    captureResultMedia,
    armNudge,
    showNudge,
    dismissNudge,
    end,
    reset
  }
})
