import { defineStore } from 'pinia'
import { computed, getCurrentScope, onScopeDispose, shallowRef } from 'vue'

/**
 * Signals onboarding overlays that live outside the tour store (the agent
 * onboarding coach is the first), so the What's New popup can defer to them as
 * it already does to `activeTour`. A source registers a getter and drops it on
 * teardown, so an unmounted overlay cannot leak as permanently active.
 */
export const useOnboardingOverlayStore = defineStore(
  'onboardingOverlay',
  () => {
    const sources = shallowRef(new Set<() => boolean>())

    const active = computed(() =>
      [...sources.value].some((isActive) => isActive())
    )

    function registerSource(isActive: () => boolean): () => void {
      // Wrap so each call owns a unique entry; two callers passing the same
      // getter reference must not collapse to one, or one stop() drops both.
      const source = () => isActive()
      sources.value = new Set(sources.value).add(source)
      const stop = () => {
        const next = new Set(sources.value)
        next.delete(source)
        sources.value = next
      }
      // Drop the source with the caller's scope, so a component consumer cannot
      // forget teardown and leak it. Direct callers outside a scope stop by hand.
      if (getCurrentScope()) onScopeDispose(stop)
      return stop
    }

    return { active, registerSource }
  }
)
