import { computed, effectScope, getCurrentScope, ref, watch } from 'vue'

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
  const owner = getCurrentScope() ?? effectScope(true)
  let logging = false

  const decision = computed(() =>
    eligible() ? store.decideFor(surface) : null
  )

  function startLogging() {
    if (logging) return
    logging = true
    queueMicrotask(() => {
      if (!owner.active) return
      owner.run(() =>
        watch(
          () =>
            decision.value?.kind === 'defer'
              ? `defer:${decision.value.by}`
              : (decision.value?.kind ?? 'none'),
          (key, previous) => {
            if (key === 'show')
              store.record({ surface, tier, outcome: 'shown' })
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
      )
    })
  }

  const shouldShow = computed(() => {
    startLogging()
    return decision.value?.kind === 'show'
  })

  store.registerSource({
    id: surface,
    ...SURFACES[surface],
    isActive: () => shouldShow.value
  })

  return { shouldShow }
}

/**
 * Gates a surface that is started once rather than rendered from state. `run`
 * fires the first time the surface is eligible and the screen allows it, so a
 * flag it burns on show is never spent while the surface is held back.
 */
export function useGatedAction(
  surface: SurfaceId,
  eligible: () => boolean,
  run: () => void | Promise<void>
) {
  const started = ref(false)
  const { shouldShow } = useGatedSurface(
    surface,
    () => eligible() && !started.value
  )

  watch(
    shouldShow,
    (show) => {
      if (!show) return
      started.value = true
      void run()
    },
    { immediate: true }
  )

  return { started }
}
