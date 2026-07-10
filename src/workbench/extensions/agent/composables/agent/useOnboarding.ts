import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

export interface CoachStep {
  // A host DOM selector the spotlight anchors to (e.g. '#graph-canvas'). When the
  // target is missing the coachmark stays hidden rather than pointing at nothing.
  target: string
  title: string
  body: string
}

/**
 * Onboarding coachmark state: persist-once (shown a single time per browser). Host DOM
 * anchoring lives in the OnboardingCoach component; this only owns whether the single
 * coachmark should show at all.
 */
export function useOnboarding(storageKey = 'Comfy.AgentPanel.onboarded') {
  const seen = useStorage(storageKey, false)

  const active = computed(() => !seen.value)

  function finish(): void {
    seen.value = true
  }

  return { active, finish }
}
