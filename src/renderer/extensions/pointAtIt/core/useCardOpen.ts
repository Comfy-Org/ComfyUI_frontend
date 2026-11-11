import { useActiveElement, useElementHover, useFocusWithin } from '@vueuse/core'
import { computed } from 'vue'
import type { Ref } from 'vue'

const LEAVE_DELAY_MS = 120

export function useCardOpen(target: Readonly<Ref<HTMLElement | null>>) {
  const hovered = useElementHover(target, { delayLeave: LEAVE_DELAY_MS })
  const { focused } = useFocusWithin(target)
  const active = useActiveElement()
  const focusShown = computed(
    () => focused.value && (active.value?.matches(':focus-visible') ?? false)
  )
  return computed(() => hovered.value || focusShown.value)
}
