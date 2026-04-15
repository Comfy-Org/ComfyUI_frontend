import { gsap, ScrollTrigger } from './gsapSetup'

let initialized = false

export async function initSmoothScroll() {
  if (initialized) return
  initialized = true

  const ua = navigator.userAgent
  const isWindows = /Windows/.test(ua)
  const isLinux = /Linux/.test(ua) && !/Android/.test(ua)
  if (!isWindows && !isLinux) return

  const { default: Lenis } = await import('lenis')

  const lenis = new Lenis()
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
}
