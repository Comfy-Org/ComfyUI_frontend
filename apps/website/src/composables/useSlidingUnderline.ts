import type { Ref } from 'vue'
import { nextTick, onMounted, ref, watch } from 'vue'

import { useResizeObserver } from '@vueuse/core'

// One underline that travels to the tab you picked, rather than a border that
// blinks out under one heading and in under the next.
export function useSlidingUnderline(
  nav: Ref<HTMLElement | null>,
  watched: () => unknown,
  selector = '[aria-pressed="true"]'
) {
  const underline = ref({ left: 0, width: 0 })

  function measure() {
    const current = nav.value?.querySelector<HTMLElement>(selector)
    underline.value = current
      ? { left: current.offsetLeft, width: current.offsetWidth }
      : { left: 0, width: 0 }
  }

  onMounted(() => void nextTick(measure))
  useResizeObserver(nav, measure)
  watch(watched, () => void nextTick(measure))

  return underline
}
