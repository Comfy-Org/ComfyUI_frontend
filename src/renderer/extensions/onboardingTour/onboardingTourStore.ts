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
  /** True once the tour ends into the post-run nudge (rendered by the nudge component). */
  const nudgePending = ref(false)

  const currentStep = computed<TourStep | null>(
    () => steps.value[stepIndex.value] ?? null
  )
  const totalSteps = computed(() => steps.value.length)

  /** Reveal every node targeted by steps up to and including `stepIndex`. */
  function syncRevealed() {
    const revealed = new Set<NodeId>()
    for (const step of steps.value.slice(0, stepIndex.value + 1)) {
      if (step.nodeId !== null) revealed.add(step.nodeId)
      // The prompt lives inside a subgraph; reveal its collapsed host node so
      // the user sees where to type (or the port fallback lands).
      if (step.prompt) revealed.add(step.prompt.subgraphNodeId)
    }
    revealedNodeIds.value = revealed
  }

  function start(workflow: ComfyWorkflowJSON, templateId?: string) {
    reset()
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
    syncRevealed()
  }

  function back() {
    if (stepIndex.value <= 0) return
    stepIndex.value -= 1
    promptPortFallback.value = false
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

  function markNudgePending() {
    nudgePending.value = true
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
    nudgePending.value = false
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
    nudgePending,
    start,
    advance,
    back,
    captureResultMedia,
    markNudgePending,
    end,
    reset
  }
})
