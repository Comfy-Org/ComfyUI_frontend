import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

// A phone keyboard does not shrink the window, it covers it, and a fixed
// element keeps the size of what it covers. What is actually on screen is the
// visual viewport, so a sheet meant to fill the screen follows that instead.
export function useVisualViewport() {
  const height = ref<number | null>(null)
  const offsetTop = ref(0)

  const viewport =
    typeof window === 'undefined' ? undefined : window.visualViewport
  const read = () => {
    if (!viewport) return
    height.value = viewport.height
    offsetTop.value = viewport.offsetTop
  }

  read()
  useEventListener(viewport, ['resize', 'scroll'], read)

  return { height, offsetTop }
}
