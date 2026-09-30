import { useTimestamp } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

import type {
  Allowance,
  ReshootLimitKind
} from '../lib/workshop/cinematic-studio/reshoot-limits'
import {
  RESHOOT_LIMITS,
  allowance,
  pruneRuns
} from '../lib/workshop/cinematic-studio/reshoot-limits'

const storageKey = (kind: ReshootLimitKind, owner: string) =>
  `comfy.reshoot.runs.${kind}.${owner}`

/** The stored run times, or undefined when storage cannot be read. */
function readRuns(key: string): number[] | undefined {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((at): at is number => typeof at === 'number')
      : []
  } catch {
    return undefined
  }
}

function writeRuns(key: string, runs: readonly number[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(runs))
    return true
  } catch {
    return false
  }
}

/**
 * One person's recent Re-shoot runs of one kind, counted against
 * RESHOOT_LIMITS so the page can say what is left before anything is refused.
 */
export function useReshootAllowance(
  kind: ReshootLimitKind,
  owner: MaybeRefOrGetter<string | undefined>
) {
  const limit = RESHOOT_LIMITS[kind]
  const now = useTimestamp({ interval: 30_000 })
  const key = computed(() => storageKey(kind, toValue(owner) ?? 'guest'))
  const runs = ref<number[]>([])
  // Without working storage the count lives in memory for this visit.
  let stored = true
  watch(key, (next) => (runs.value = readRuns(next) ?? []), { immediate: true })

  const left = computed<Allowance>(() =>
    allowance(runs.value, limit, now.value)
  )

  function record(at = Date.now()) {
    const latest = (stored && readRuns(key.value)) || runs.value
    runs.value = [...pruneRuns(latest, limit, at), at]
    stored = writeRuns(key.value, runs.value)
  }

  return { allowance: left, record }
}
