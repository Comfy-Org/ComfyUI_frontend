import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { gsap } from '../scripts/gsapSetup'
import { prefersReducedMotion } from './useReducedMotion'

interface PinScrubRefs {
  section: Ref<HTMLElement | undefined>
  content: Ref<HTMLElement | undefined>
  nav: Ref<HTMLElement | undefined>
}

interface PinScrubOptions {
  itemCount: number
  /** Viewport-height percentage per item (default: 100) */
  vhPerItem?: number
}

function interpolateY(
  index: number,
  buttonCenters: number[],
  contentH: number,
  vpH: number
) {
  const clampedTarget = (i: number) => {
    const center = buttonCenters[i] ?? 0
    return Math.max(-(contentH - vpH), Math.min(0, vpH / 2 - center))
  }

  const floorIdx = Math.floor(index)
  const ceilIdx = Math.min(Math.ceil(index), buttonCenters.length - 1)
  const frac = index - floorIdx
  return (
    clampedTarget(floorIdx) +
    (clampedTarget(ceilIdx) - clampedTarget(floorIdx)) * frac
  )
}

export function usePinScrub(refs: PinScrubRefs, options: PinScrubOptions) {
  const activeIndex = ref(0)
  let ctx: gsap.Context | undefined
  let scrollTriggerInstance: ScrollTrigger | undefined

  const vhPerItem = options.vhPerItem ?? 100

  function scrollToIndex(index: number) {
    if (!scrollTriggerInstance) {
      activeIndex.value = index
      return
    }
    const progress = index / (options.itemCount - 1)
    const scrollPos =
      scrollTriggerInstance.start +
      progress * (scrollTriggerInstance.end - scrollTriggerInstance.start)
    gsap.to(window, {
      scrollTo: { y: scrollPos, autoKill: false },
      duration: 0.6,
      ease: 'power2.inOut'
    })
  }

  onMounted(() => {
    if (
      !refs.section.value ||
      !refs.content.value ||
      !refs.nav.value ||
      prefersReducedMotion()
    )
      return
    const section: HTMLElement = refs.section.value
    const content: HTMLElement = refs.content.value
    const nav: HTMLElement = refs.nav.value

    let buttonCenters: number[] = []
    let contentH = 0
    let vpH = 0

    function cacheLayout() {
      const contentRect = content.getBoundingClientRect()
      const sectionStyle = getComputedStyle(section)
      contentH = content.scrollHeight
      vpH = window.innerHeight - parseFloat(sectionStyle.paddingTop)
      buttonCenters = Array.from(nav.querySelectorAll(':scope > *')).map(
        (btn) => {
          const btnRect = btn.getBoundingClientRect()
          return btnRect.top + btnRect.height / 2 - contentRect.top
        }
      )
    }

    cacheLayout()

    const proxy = { index: 0 }
    ctx = gsap.context(() => {
      gsap.to(proxy, {
        index: options.itemCount - 1,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: `+=${options.itemCount * vhPerItem}%`,
          pin: true,
          scrub: true,
          refreshPriority: 1,
          onRefresh: cacheLayout,
          onUpdate(self) {
            scrollTriggerInstance = self
          }
        },
        onUpdate() {
          activeIndex.value = Math.round(proxy.index)

          if (contentH <= vpH) {
            gsap.set(content, { y: 0 })
            return
          }

          gsap.set(content, {
            y: interpolateY(proxy.index, buttonCenters, contentH, vpH)
          })
        }
      })
    })
  })

  onUnmounted(() => {
    ctx?.revert()
  })

  return { activeIndex, scrollToIndex }
}
