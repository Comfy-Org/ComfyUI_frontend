import { defineStore } from 'pinia'
import { getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'

import { useTelemetry } from '@/platform/telemetry'

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
    useTelemetry()?.trackInterruptionExposure({
      surface: entry.surface,
      tier: entry.tier,
      outcome: entry.outcome,
      ...(entry.by === undefined ? {} : { blocked_by: entry.by })
    })
  }

  return { exposures, registerSource, decideFor, record }
})
