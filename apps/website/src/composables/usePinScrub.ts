import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref } from 'vue'
import type { ScrollTrigger } from '../scripts/gsapSetup'
import { gsap } from '../scripts/gsapSetup'
import { scrollTo } from '../scripts/smoothScroll'
import { prefersReducedMotion } from './useReducedMotion'

interface PinScrubRefs {
  section: Ref<HTMLElement | undefined>
  content: Ref<HTMLElement | undefined>
  nav: Ref<HTMLElement | undefined>
}

interface PinScrubOptions {
  itemCount: number
  /** Viewport-height percentage per item (default: 20) */
  vhPerItem?: number
}

/** Viewport-height percentage each category occupies in the scroll distance. */
export const VH_PER_ITEM = 20

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
  const isEnabled = ref(false)
  let ctx: gsap.Context | undefined
  let scrollTriggerInstance: ScrollTrigger | undefined

  const vhPerItem = options.vhPerItem ?? VH_PER_ITEM

  function scrollToIndex(index: number) {
    if (!scrollTriggerInstance) {
      activeIndex.value = index
      return
    }
    const progress = index / (options.itemCount - 1)
    const scrollPos =
      scrollTriggerInstance.start +
      progress * (scrollTriggerInstance.end - scrollTriggerInstance.start)
    scrollTo(scrollPos, { duration: 0.6 })
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
    isEnabled.value = true
    const setContentY = gsap.quickSetter(content, 'y', 'px')

    ctx = gsap.context(() => {
      const tween = gsap.to(
        {},
        {
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: `+=${options.itemCount * vhPerItem}%`,
            pin: true,
            scrub: true,
            snap: {
              snapTo: 1 / (options.itemCount - 1),
              duration: { min: 0.2, max: 0.6 },
              delay: 0.1,
              ease: 'power1.inOut'
            },
            onRefresh: cacheLayout,
            onUpdate(self) {
              const index = self.progress * (options.itemCount - 1)
              const nextActive = Math.round(index)

              if (nextActive !== activeIndex.value) {
                activeIndex.value = nextActive
              }

              if (contentH <= vpH) {
                setContentY(0)
                return
              }

              setContentY(interpolateY(index, buttonCenters, contentH, vpH))
            }
          }
        }
      )
      scrollTriggerInstance = tween.scrollTrigger as ScrollTrigger
    })
  })

  onUnmounted(() => {
    isEnabled.value = false
    ctx?.revert()
  })

  return { activeIndex, isEnabled, scrollToIndex }
}
