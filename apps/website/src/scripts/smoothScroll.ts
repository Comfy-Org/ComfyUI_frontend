import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

function needsLenis(): boolean {
  const ua = navigator.userAgent
  const isWindows = /Windows/.test(ua)
  const isLinux = /Linux/.test(ua) && !/Android/.test(ua)
  return isWindows || isLinux
}

let lenis: Lenis | undefined

export function initSmoothScroll() {
  if (lenis) return

  if (!needsLenis()) return

  lenis = new Lenis()

  lenis.on('scroll', ScrollTrigger.update)

  gsap.ticker.add((time) => {
    lenis!.raf(time * 1000)
  })
  gsap.ticker.lagSmoothing(0)
}

export { gsap, ScrollTrigger }
