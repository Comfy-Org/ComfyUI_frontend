import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'

import { gsap } from '../scripts/gsapSetup'
import { prefersReducedMotion } from './useReducedMotion'

export function useHeroAnimation(refs: {
  section: Ref<HTMLElement | undefined>
  textEls: Ref<HTMLElement | undefined>[]
  logo?: Ref<HTMLElement | undefined>
  video?: Ref<HTMLElement | undefined>
  parallax?: boolean
}) {
  const { parallax = true } = refs
  let ctx: gsap.Context | undefined

  onMounted(() => {
    if (prefersReducedMotion()) return

    const section = refs.section.value
    const textEls = refs.textEls.map((r) => r.value).filter(Boolean)
    const logo = refs.logo?.value
    const video = refs.video?.value
    if (!section || !textEls.length) return

    ctx = gsap.context(() => {
      gsap.from(textEls, {
        y: 60,
        autoAlpha: 0,
        duration: 1,
        stagger: 0.12,
        ease: 'power2.out'
      })

      if (logo) {
        gsap.from(logo, {
          x: -80,
          y: 80,
          autoAlpha: 0,
          duration: 1.2,
          delay: 0.15,
          ease: 'power2.out'
        })
      }

      if (video) {
        gsap.from(video, {
          y: 120,
          autoAlpha: 0,
          duration: 1,
          delay: 0.3,
          ease: 'power2.out'
        })

        if (parallax) {
          gsap.to(video, {
            yPercent: -10,
            ease: 'none',
            immediateRender: false,
            scrollTrigger: {
              trigger: section,
              start: 'clamp(top top)',
              end: 'clamp(bottom top)',
              scrub: 1
            }
          })
        }
      }
    })
  })

  onUnmounted(() => {
    ctx?.revert()
  })
}
