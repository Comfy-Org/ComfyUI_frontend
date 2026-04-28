import { usePreferredReducedMotion } from '@vueuse/core'
import { ref } from 'vue'

const motion =
  typeof window !== 'undefined'
    ? usePreferredReducedMotion()
    : ref('no-preference')

export function prefersReducedMotion(): boolean {
  return motion.value === 'reduce'
}
