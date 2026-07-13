import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { NodeId } from '@/types/nodeId'
import { resolveNode } from '@/utils/litegraphUtil'

import { resolveRoles } from './roleResolver'
import { restoreView } from './subgraphNavigation'
import { sequenceBuilder } from './tourSequence'
import type { MediaKind, ResolvedRoles, TourStep } from './tourSequence'

export type TourPhase = 'idle' | 'active'
export type RunStatus = 'idle' | 'running' | 'completed'
export type TourEndReason = 'done' | 'skip' | 'error'

export interface ResultMedia {
  url: string
  kind: MediaKind
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
  const runStatus = ref<RunStatus>('idle')
  /** Set when programmatic prompt focus failed and the port is spotlit instead. */
  const promptPortFallback = ref(false)
  /**
   * Set when prompt focus entered the subgraph. While true, the prompt step
   * spotlights the inner text node (now on-screen) instead of the collapsed
   * host, which no longer resolves against the entered inner graph.
   */
  const promptEntered = ref(false)
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

  /** Reveal every node targeted by steps up to and including `stepIndex`. */
  function syncRevealed() {
    const revealed = new Set<NodeId>()
    for (const [index, step] of steps.value
      .slice(0, stepIndex.value + 1)
      .entries()) {
      if (step.nodeId !== null) revealed.add(step.nodeId)
      // The prompt lives inside a subgraph. Once focus enters that subgraph the
      // inner text node is on-screen and the collapsed host no longer resolves,
      // so reveal the inner node then; otherwise reveal the host (or the port
      // fallback lands there).
      if (step.prompt) {
        const isCurrent = index === stepIndex.value
        revealed.add(
          isCurrent && promptEntered.value
            ? step.prompt.innerNodeId
            : step.prompt.subgraphNodeId
        )
      }
    }
    revealedNodeIds.value = revealed
  }

  /**
   * Record whether prompt focus entered the subgraph, then re-reveal so the
   * spotlight targets the inner text node (entered) or the collapsed host (not).
   */
  function setPromptEntered(entered: boolean) {
    promptEntered.value = entered
    syncRevealed()
  }

  function start(workflow: ComfyWorkflowJSON, templateId?: string) {
    reset()
    resetNudge()
    const roles = resolveRoles(workflow, templateId)
    resolvedRoles.value = roles
    steps.value = sequenceBuilder(roles)
    phase.value = 'active'
    syncRevealed()
  }

  function advance() {
    if (stepIndex.value >= steps.value.length - 1) return
    stepIndex.value += 1
    promptPortFallback.value = false
    promptEntered.value = false
    syncRevealed()
  }

  function back() {
    if (stepIndex.value <= 0) return
    stepIndex.value -= 1
    promptPortFallback.value = false
    promptEntered.value = false
    syncRevealed()
  }

  /**
   * Record the sink's generated output as the Result step's media. The URL is
   * server-built (`/view?...`) and rendered via a bound `:src`; the media kind
   * comes from the resolved sink, not the output MIME, so a restored-from-URL
   * result still picks the right renderer. No-op unless the tour is active and
   * the sink both resolves and has an output.
   */
  function captureResultMedia() {
    if (phase.value !== 'active') return
    const sink = resolvedRoles.value?.sink
    if (!sink) return

    const node = resolveNode(sink.nodeId)
    if (!node) return

    const [url] = useNodeOutputStore().getNodeImageUrls(node) ?? []
    if (!url) return

    resultMedia.value = { url, kind: resolvedRoles.value?.mediaKind ?? 'image' }
    runStatus.value = 'completed'
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
    runStatus.value = 'idle'
    promptPortFallback.value = false
    promptEntered.value = false
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
    resultMedia,
    runStatus,
    promptPortFallback,
    shouldShowNudge,
    nudgeArmed,
    start,
    advance,
    back,
    setPromptEntered,
    captureResultMedia,
    armNudge,
    showNudge,
    dismissNudge,
    end,
    reset
  }
})
