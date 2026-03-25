import type { Ref } from 'vue'

import { useMouseInElement } from '@vueuse/core'
import { ref, watch } from 'vue'

export function useSliderFromMouse(target: Ref<HTMLElement | null>) {
  const position = ref(50)
  const { elementX, elementWidth, isOutside } = useMouseInElement(target)

  watch([elementX, elementWidth, isOutside], ([x, width, outside]) => {
    if (!outside && width > 0) {
      position.value = (x / width) * 100
    }
  })

  return position
}
