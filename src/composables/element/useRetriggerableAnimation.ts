import { onMounted, ref, watch } from 'vue'
import type { Ref, WatchSource } from 'vue'

/**
 * A composable that manages retriggerable CSS animations.
 * Provides a boolean ref that can be toggled to restart CSS animations.
 *
 * @param trigger - Optional reactive source that triggers the animation when it changes
 * @param options - Configuration options
 * @returns An object containing the animation state ref
 *
 * @example
 * ```vue
 * <template>
 *   <div :class="{ 'animate-slide-up': shouldAnimate }">
 *     Content
 *   </div>
 * </template>
 *
 * <script setup>
 * const { shouldAnimate } = useRetriggerableAnimation(someReactiveTrigger)
 * </script>
 * ```
 */
export function useRetriggerableAnimation<T = any>(
  trigger?: WatchSource<T> | Ref<T>,
  options: {
    animateOnMount?: boolean
    animationDelay?: number
  } = {}
) {
  const { animateOnMount = true, animationDelay = 0 } = options

  const shouldAnimate = ref(false)

  /**
   * Retriggers the animation by removing and re-adding the animation class
   */
  const retriggerAnimation = () => {
    // Remove animation class
    shouldAnimate.value = false
    // Force browser reflow to ensure the class removal is processed
    void document.body.offsetHeight
    // Re-add animation class in the next frame
    requestAnimationFrame(() => {
      if (animationDelay > 0) {
        setTimeout(() => {
          shouldAnimate.value = true
        }, animationDelay)
      } else {
        shouldAnimate.value = true
      }
    })
  }

  // Trigger animation on mount if requested
  if (animateOnMount) {
    onMounted(() => {
      if (animationDelay > 0) {
        setTimeout(() => {
          shouldAnimate.value = true
        }, animationDelay)
      } else {
        shouldAnimate.value = true
      }
    })
  }

  // Watch for trigger changes to retrigger animation
  if (trigger) {
    watch(trigger, () => {
      retriggerAnimation()
    })
  }

  return {
    shouldAnimate,
    retriggerAnimation
  }
}
