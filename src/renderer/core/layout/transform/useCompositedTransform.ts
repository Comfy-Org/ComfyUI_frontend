import { tryOnScopeDispose } from '@vueuse/core'
import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

/**
 * Mirrors an element's transform in a paused animation, so the browser updates
 * the compositor directly instead of recompositing the page on each change.
 */
export function useCompositedTransform(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>
) {
  let animation: Animation | undefined
  let animatedElement: HTMLElement | undefined

  function setTransform(transform: string) {
    const element = toValue(target)
    if (!element) return
    element.style.transform = transform

    const keyframes = [{ transform }, { transform }]
    if (
      animatedElement === element &&
      animation?.effect instanceof KeyframeEffect
    ) {
      animation.effect.setKeyframes(keyframes)
      return
    }

    releaseTransform()
    animation = element.animate(keyframes, { duration: 1, fill: 'both' })
    animation.pause()
    animatedElement = element
  }

  function releaseTransform() {
    if (animation) animation.effect = null
    animation = undefined
    animatedElement = undefined
  }

  tryOnScopeDispose(releaseTransform)

  return { setTransform, releaseTransform }
}
