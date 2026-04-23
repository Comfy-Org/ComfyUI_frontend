import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { gsap } from '../scripts/gsapSetup'
import { prefersReducedMotion } from './useReducedMotion'

interface ParallaxOptions {
  /** Starting vertical offset in pixels (default: 0) */
  fromY?: number
  /** Ending vertical offset in pixels (default: 200) */
  y?: number
  trigger?: Ref<HTMLElement | undefined>
  /** ScrollTrigger start value (default: 'top bottom') */
  start?: string
  /** ScrollTrigger end value (default: 'bottom top') */
  end?: string
}

export function useParallax(
  elements: Ref<HTMLElement | undefined>[],
  options: ParallaxOptions = {}
) {
  const { fromY = 0, y = 200 } = options
  let ctx: gsap.Context | undefined

  onMounted(() => {
    const trigger = options.trigger?.value
    const els = elements
      .map((r) => r.value)
      .filter((el): el is HTMLElement => !!el && el.offsetParent !== null)
    if (!els.length || prefersReducedMotion()) return

    const scrollTrigger = {
      trigger: trigger ?? els[0],
      start: options.start ?? 'top bottom',
      end: options.end ?? 'bottom top',
      scrub: 1
    }

    ctx = gsap.context(() => {
      els.forEach((el) => {
        gsap.fromTo(el, { y: fromY }, { y, ease: 'none', scrollTrigger })
      })
    })
  })

  onUnmounted(() => {
    ctx?.revert()
  })
}
