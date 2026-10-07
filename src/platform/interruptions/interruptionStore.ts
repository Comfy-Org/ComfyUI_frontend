import { defineStore } from 'pinia'
import { getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'

import { useOnboardingOverlayStore } from '@/platform/onboarding/onboardingOverlayStore'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useDialogStore } from '@/stores/dialogStore'

import { SURFACES, decide, outranks } from './interruptionPolicy'
import type {
  InterruptionDecision,
  InterruptionTier,
  Interrupter,
  SurfaceId
} from './interruptionPolicy'

interface InterruptionSource extends Interrupter {
  isActive: () => boolean
}

interface ExposureEntry {
  at: number
  surface: SurfaceId
  tier: InterruptionTier
  outcome: 'shown' | 'deferred' | 'withdrawn'
  by?: string
}

const MAX_EXPOSURES = 200

export const useInterruptionStore = defineStore('interruption', () => {
  const sources = shallowRef(new Set<InterruptionSource>())
  const exposures = ref<ExposureEntry[]>([])

  function registerSource(source: InterruptionSource): () => void {
    const entry = { ...source }
    sources.value = new Set(sources.value).add(entry)
    const stop = () => {
      const next = new Set(sources.value)
      next.delete(entry)
      sources.value = next
    }
    if (getCurrentScope()) onScopeDispose(stop)
    return stop
  }

  function decideFor(surface: SurfaceId): InterruptionDecision {
    const subject = { id: surface, ...SURFACES[surface] }
    const candidates = [...sources.value].filter(
      (source) => source.id !== surface && outranks(source, subject)
    )
    return decide(
      subject,
      candidates.filter((source) => source.isActive())
    )
  }

  function record(entry: Omit<ExposureEntry, 'at'>) {
    exposures.value = [
      ...exposures.value.slice(-(MAX_EXPOSURES - 1)),
      { ...entry, at: Date.now() }
    ]
  }

  const dialogStore = useDialogStore()
  const tourStore = useOnboardingTourStore()
  const overlayStore = useOnboardingOverlayStore()
  const agentNodeSelectionStore = useAgentNodeSelectionStore()

  registerSource({
    id: 'dialog',
    tier: 'blocking',
    order: 0,
    isActive: () => dialogStore.dialogStack.some((dialog) => dialog.visible)
  })
  registerSource({
    id: 'firstRunTour',
    tier: 'blocking',
    order: 1,
    isActive: () => tourStore.activeTour === 'firstRun'
  })
  registerSource({
    id: 'onboardingOverlay',
    tier: 'blocking',
    order: 2,
    isActive: () => overlayStore.active
  })
  registerSource({
    id: 'nodeSelection',
    tier: 'blocking',
    order: 3,
    isActive: () => agentNodeSelectionStore.isActive
  })

  return { exposures, registerSource, decideFor, record }
})
