import { computed, watch } from 'vue'

import { SURFACES } from './interruptionPolicy'
import type { SurfaceId } from './interruptionPolicy'
import { useInterruptionStore } from './interruptionStore'

/**
 * Gates a surface whose own rules say it is wanted. While it is on screen it
 * registers as an interrupter so surfaces ranked below it defer in turn, and
 * each change of outcome lands in the shared exposure log.
 */
export function useGatedSurface(surface: SurfaceId, eligible: () => boolean) {
  const store = useInterruptionStore()
  const { tier } = SURFACES[surface]

  const decision = computed(() =>
    eligible() ? store.decideFor(surface) : null
  )
  const shouldShow = computed(() => decision.value?.kind === 'show')

  store.registerSource({
    id: surface,
    ...SURFACES[surface],
    isActive: () => shouldShow.value
  })

  watch(
    () =>
      decision.value?.kind === 'defer'
        ? `defer:${decision.value.by}`
        : (decision.value?.kind ?? 'none'),
    (key, previous) => {
      if (key === 'show') store.record({ surface, tier, outcome: 'shown' })
      else if (key.startsWith('defer:'))
        store.record({
          surface,
          tier,
          outcome: 'deferred',
          by: key.slice('defer:'.length)
        })
      else if (previous !== undefined)
        store.record({ surface, tier, outcome: 'withdrawn' })
    },
    { immediate: true }
  )

  return { shouldShow }
}
