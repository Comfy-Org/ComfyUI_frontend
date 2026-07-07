import { useStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

export interface CoachStep {
  // A host DOM selector the spotlight anchors to (e.g. '#graph-canvas'). A step whose
  // target is missing is skipped rather than shown pointing at nothing.
  target: string
  title: string
  body: string
}

export interface UseOnboardingOptions {
  steps: CoachStep[]
  storageKey?: string
}

/**
 * Onboarding coachmark state: persist-once (shown a single time per browser), step
 * navigation, and skip. Host DOM anchoring lives in the OnboardingCoach component; this
 * only owns which step is current and whether onboarding should run at all.
 */
export function useOnboarding(options: UseOnboardingOptions) {
  const seen = useStorage(
    options.storageKey ?? 'Comfy.AgentPanel.onboarded',
    false
  )
  const index = ref(0)

  const active = computed(() => !seen.value && options.steps.length > 0)
  const currentStep = computed(() => options.steps[index.value] ?? null)
  const isLast = computed(() => index.value >= options.steps.length - 1)

  function finish(): void {
    seen.value = true
    index.value = 0
  }

  function next(): void {
    if (isLast.value) finish()
    else index.value += 1
  }

  function skip(): void {
    finish()
  }

  function restart(): void {
    index.value = 0
    seen.value = false
  }

  return { active, currentStep, index, isLast, next, skip, finish, restart }
}
