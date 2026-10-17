import '@testing-library/jest-dom/vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/vue'
import { afterAll, afterEach, expect, vi } from 'vitest'

import type * as GsapSetup from '@/scripts/gsapSetup'

expect.extend(matchers)

afterEach(cleanup)

const loadedGsapSetups = vi.hoisted(() => new Set<typeof GsapSetup>())

vi.mock(import('@/scripts/gsapSetup'), async (importOriginal) => {
  const gsapSetup = await importOriginal()
  loadedGsapSetups.add(gsapSetup)
  return gsapSetup
})

afterAll(() => {
  if (typeof window === 'undefined') return
  for (const { gsap, ScrollTrigger } of loadedGsapSetups) {
    ScrollTrigger.killAll()
    ScrollTrigger.disable()
    gsap.ticker.sleep()
  }
})
