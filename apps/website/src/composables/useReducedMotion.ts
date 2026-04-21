import { usePreferredReducedMotion } from '@vueuse/core'

const motion = usePreferredReducedMotion()

export function prefersReducedMotion(): boolean {
  return motion.value === 'reduce'
}
