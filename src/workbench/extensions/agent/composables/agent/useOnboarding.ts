import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

export interface CoachStep {
  target: string
  title: string
  body: string
}

export function useOnboarding(storageKey = 'Comfy.AgentPanel.onboarded') {
  const seen = useStorage(storageKey, false)

  const active = computed(() => !seen.value)

  function finish(): void {
    seen.value = true
  }

  return { active, finish }
}
