import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { gsap } from '../scripts/gsapSetup'
import { prefersReducedMotion } from './useReducedMotion'

type ValueOrFn = number | ((el: HTMLElement, trigger: HTMLElement) => number)

function resolve(v: ValueOrFn, el: HTMLElement, trigger: HTMLElement): number {
  return typeof v === 'function' ? v(el, trigger) : v
}

interface ParallaxOptions {
  /** Starting vertical offset in pixels, or a function resolved at mount */
  fromY?: ValueOrFn
  /** Ending vertical offset in pixels, or a function resolved at mount */
  y?: ValueOrFn
  trigger?: Ref<HTMLElement | undefined>
  /** ScrollTrigger start value (default: 'top bottom') */
  start?: string
  /** ScrollTrigger end value (default: 'bottom top') */
  end?: string
  /** Media query string — animation only runs when matched (responsive) */
  mediaQuery?: string
}

export function useParallax(
  elements: Ref<HTMLElement | undefined>[],
  options: ParallaxOptions = {}
) {
  const { fromY = 0, y = 200 } = options
  let ctx: gsap.Context | gsap.MatchMedia | undefined

  onMounted(() => {
    const triggerEl = options.trigger?.value
    const els = elements
      .map((r) => r.value)
      .filter((el): el is HTMLElement => !!el && el.offsetParent !== null)
    if (!els.length || prefersReducedMotion()) return

    const trigger = triggerEl ?? els[0]
    const scrollTrigger = {
      trigger,
      start: options.start ?? 'top bottom',
      end: options.end ?? 'bottom top',
      scrub: 1
    }

    const createAnimations = () => {
      els.forEach((el) => {
        gsap.fromTo(
          el,
          { y: resolve(fromY, el, trigger) },
          { y: resolve(y, el, trigger), ease: 'none', scrollTrigger }
        )
      })
    }

    if (options.mediaQuery) {
      const mm = gsap.matchMedia()
      mm.add(options.mediaQuery, createAnimations)
      ctx = mm
    } else {
      ctx = gsap.context(createAnimations)
    }
  })

  onUnmounted(() => {
    ctx?.revert()
  })
}
