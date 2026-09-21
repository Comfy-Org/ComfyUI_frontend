import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

/**
 * Signals onboarding overlays that live outside the tour store (the agent
 * onboarding coach is the first), so the What's New popup can defer to them as
 * it already does to `activeTour`. Sources register a getter and drop it on
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
      sources.value = new Set(sources.value).add(isActive)
      return () => {
        const next = new Set(sources.value)
        next.delete(isActive)
        sources.value = next
      }
    }

    return { active, registerSource }
  }
)
