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

function readRuns(key: string): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((at): at is number => typeof at === 'number')
      : []
  } catch {
    return []
  }
}

function writeRuns(key: string, runs: readonly number[]) {
  try {
    localStorage.setItem(key, JSON.stringify(runs))
  } catch {
    // Storage unavailable: the count lasts for this visit only.
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
  watch(key, (next) => (runs.value = readRuns(next)), { immediate: true })

  const left = computed<Allowance>(() =>
    allowance(runs.value, limit, now.value)
  )

  function record(at = Date.now()) {
    runs.value = [...pruneRuns(readRuns(key.value), limit, at), at]
    writeRuns(key.value, runs.value)
  }

  return { allowance: left, record }
}
