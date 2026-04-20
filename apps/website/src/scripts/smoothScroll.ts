import type Lenis from 'lenis'

import { gsap, ScrollTrigger } from './gsapSetup'
import { prefersReducedMotion } from '../composables/useReducedMotion'

let lenis: Lenis | undefined

let initialized = false

export async function initSmoothScroll() {
  if (initialized) return
  initialized = true

  if (prefersReducedMotion()) return

  const ua = navigator.userAgent
  const isWindows = /Windows/.test(ua)
  const isLinux = /Linux/.test(ua) && !/Android/.test(ua)
  if (!isWindows && !isLinux) return

  const { default: Lenis } = await import('lenis')

  lenis = new Lenis()
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis!.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
}

export interface ScrollToOptions {
  offset?: number
  duration?: number
  immediate?: boolean
  onComplete?: () => void
}

export function scrollTo(
  target: HTMLElement | number,
  options: ScrollToOptions = {}
) {
  const { offset = 0, duration = 0.6, immediate = false, onComplete } = options

  if (lenis) {
    lenis.scrollTo(target, {
      offset,
      duration: immediate ? 0 : duration,
      immediate,
      onComplete
    })
    return
  }

  const y =
    typeof target === 'number'
      ? target + offset
      : target.getBoundingClientRect().top + window.scrollY + offset

  if (immediate) {
    window.scrollTo(0, y)
    onComplete?.()
    return
  }

  gsap.to(window, {
    scrollTo: { y, autoKill: false },
    duration,
    ease: 'power2.inOut',
    onComplete
  })
}

export function stopScroller() {
  lenis?.stop()
}

export function startScroller() {
  lenis?.start()
}

export function cancelScroll() {
  if (lenis?.isScrolling) {
    lenis.stop()
    lenis.start()
  }
}
