import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { gsap } from '../scripts/gsapSetup'
import { prefersReducedMotion } from './useReducedMotion'

interface ParallaxOptions {
  /** Vertical offset in pixels (default: 200) */
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
  const { y = 200 } = options
  let ctx: gsap.Context | undefined

  onMounted(() => {
    const trigger = options.trigger?.value
    const els = elements.map((r) => r.value).filter(Boolean) as HTMLElement[]
    if (!els.length || prefersReducedMotion()) return

    ctx = gsap.context(() => {
      els.forEach((el) => {
        gsap.to(el, {
          y,
          ease: 'none',
          scrollTrigger: {
            trigger: trigger ?? el,
            start: options.start ?? 'top bottom',
            end: options.end ?? 'bottom top',
            scrub: 1
          }
        })
      })
    })
  })

  onUnmounted(() => {
    ctx?.revert()
  })
}
