import { useStorage } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export interface CoachStep {
  target: string
  title: string
  body: string
  placement: 'left-center' | 'left-end' | 'graph-bottom' | 'left-start'
  toolbarTarget?: string
  videoUrl?: string
}

export function useOnboarding(
  steps: MaybeRefOrGetter<CoachStep[]>,
  storageKey = 'Comfy.AgentPanel.onboarded'
) {
  const seen = useStorage(storageKey, false)
  const index = ref(0)
  const step = computed(() => toValue(steps)[index.value])
  const active = computed(() => !seen.value && !!step.value)
  const isLast = computed(() => index.value === toValue(steps).length - 1)

  function finish(): void {
    seen.value = true
  }

  function next(): void {
    if (!active.value) return
    if (isLast.value) finish()
    else index.value += 1
  }

  return { active, index, step, isLast, next, finish }
}
