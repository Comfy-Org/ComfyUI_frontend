import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeId } from '@/types/nodeId'

import type { MediaKind, ResolvedRoles } from './tourSequence'

export type TourPhase = 'idle' | 'active' | 'ended'
export type RunStatus = 'idle' | 'running' | 'completed'

export interface ResultMedia {
  url: string
  kind: MediaKind
}

/**
 * Tour state: step position, resolved roles, which nodes are
 * currently revealed, and the run/result of the user's first generation. All
 * litegraph reads happen through the canvas adapter, never here.
 */
export const useOnboardingTourStore = defineStore('onboardingTour', () => {
  const phase = ref<TourPhase>('idle')
  const stepIndex = ref(0)
  const resolvedRoles = ref<ResolvedRoles | null>(null)
  const revealedNodeIds = ref<Set<NodeId>>(new Set())
  const resultMedia = ref<ResultMedia | null>(null)
  const runStatus = ref<RunStatus>('idle')

  function reset() {
    phase.value = 'idle'
    stepIndex.value = 0
    resolvedRoles.value = null
    revealedNodeIds.value = new Set()
    resultMedia.value = null
    runStatus.value = 'idle'
  }

  return {
    phase,
    stepIndex,
    resolvedRoles,
    revealedNodeIds,
    resultMedia,
    runStatus,
    reset
  }
})
