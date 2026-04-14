import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { gsap } from '../scripts/gsapSetup'
import { prefersReducedMotion } from './useReducedMotion'

interface ParallaxOptions {
  /** Vertical offset in pixels (default: 200) */
  y?: number
  trigger?: Ref<HTMLElement | undefined>
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
            start: 'top bottom',
            end: 'bottom top',
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
