// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import type { Ref } from 'vue'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import type { CameraPose } from './cameraVocabulary'
import { DEFAULT_POSE } from './cameraVocabulary'
import { useIdleAutoplay } from './useIdleAutoplay'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => motion.reduced
}))

const START_DELAY = 1500

interface Harness {
  pose: CameraPose
  hue: Ref<number>
  saturation: Ref<number>
  hero: HTMLElement
  angle: HTMLElement
  stop: () => void
}

function mountAutoplay(): Harness {
  const hero = document.createElement('div')
  const angle = document.createElement('div')
  angle.setAttribute('data-hero-angle', '')
  angle.setAttribute('data-camera-scene', '')
  hero.appendChild(angle)
  document.body.appendChild(hero)

  const pose = reactive({ ...DEFAULT_POSE })
  const hue = ref(0)
  const saturation = ref(1)

  const scope = effectScope()
  scope.run(() =>
    useIdleAutoplay({ pose, hue, saturation }, ref(hero) as Ref<HTMLElement>)
  )
  return { pose, hue, saturation, hero, angle, stop: () => scope.stop() }
}

/** Arms the demo: element visible, idle past the start delay, first frames
 * elapsed so the pose is in motion. */
async function armAndPlay() {
  await setAllIntersecting(true)
  await vi.advanceTimersByTimeAsync(START_DELAY + 500)
}

describe('useIdleAutoplay', () => {
  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
  })

  it('starts one orbit after the idle delay and eases the pose forward', async () => {
    const harness = mountAutoplay()

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(START_DELAY - 100)
    expect(harness.pose.azimuth).toBe(0)

    await vi.advanceTimersByTimeAsync(100 + 500)
    expect(harness.pose.azimuth).toBeGreaterThan(0)
    expect(harness.hue.value).toBeGreaterThan(0)
    harness.stop()
  })

  it('completes a full orbit landing back on the starting pose, then stops', async () => {
    const harness = mountAutoplay()
    await armAndPlay()

    // 8 legs x 2.5s, generously padded.
    await vi.advanceTimersByTimeAsync(25_000)
    expect(harness.pose.azimuth).toBe(0)
    expect(harness.pose.elevation).toBe(0)
    expect(harness.hue.value).toBe(0)

    // Done for good: further idle time never restarts the tour.
    const settled = { ...harness.pose }
    await vi.advanceTimersByTimeAsync(10_000)
    expect(harness.pose).toEqual(settled)
    harness.stop()
  })

  it('never arms when the visitor presses with a mouse first', async () => {
    const harness = mountAutoplay()
    await setAllIntersecting(true)

    harness.hero.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true })
    )
    await vi.advanceTimersByTimeAsync(START_DELAY + 5000)
    expect(harness.pose.azimuth).toBe(0)
    harness.stop()
  })

  it('cancels mid-tour on a wheel over the 3D scene, for good', async () => {
    const harness = mountAutoplay()
    await armAndPlay()
    expect(harness.pose.azimuth).toBeGreaterThan(0)

    harness.angle.dispatchEvent(new Event('wheel', { bubbles: true }))
    await nextTick()

    const atCancel = harness.pose.azimuth
    await vi.advanceTimersByTimeAsync(5000)
    expect(harness.pose.azimuth).toBe(atCancel)
    harness.stop()
  })

  it('a touch dismisses only when it lands on a control', async () => {
    const harness = mountAutoplay()
    await setAllIntersecting(true)

    // A touch on the hero at large is the page scrolling past.
    harness.hero.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })
    )
    await vi.advanceTimersByTimeAsync(START_DELAY + 500)
    expect(harness.pose.azimuth).toBeGreaterThan(0)

    // A touch on the camera scene takes the controls.
    harness.angle.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })
    )
    await nextTick()
    const atCancel = harness.pose.azimuth
    await vi.advanceTimersByTimeAsync(5000)
    expect(harness.pose.azimuth).toBe(atCancel)
    harness.stop()
  })

  it('holds while hovering the 3D node and resumes the same tour after', async () => {
    const harness = mountAutoplay()
    await armAndPlay()

    harness.angle.dispatchEvent(
      new PointerEvent('pointerover', { bubbles: true })
    )
    await nextTick()
    const held = harness.pose.azimuth
    await vi.advanceTimersByTimeAsync(1000)
    expect(harness.pose.azimuth).toBe(held)

    harness.hero.dispatchEvent(new PointerEvent('pointerleave'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(harness.pose.azimuth).toBeGreaterThan(held)
    harness.stop()
  })

  it('pauses off screen and picks the tour back up when visible again', async () => {
    const harness = mountAutoplay()
    await armAndPlay()

    await setAllIntersecting(false)
    await nextTick()
    const offScreen = harness.pose.azimuth
    await vi.advanceTimersByTimeAsync(2000)
    expect(harness.pose.azimuth).toBe(offScreen)

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(harness.pose.azimuth).toBeGreaterThan(offScreen)
    harness.stop()
  })

  it('stays off entirely under prefers-reduced-motion', async () => {
    motion.reduced = true
    const harness = mountAutoplay()

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(START_DELAY + 5000)
    expect(harness.pose.azimuth).toBe(0)
    harness.stop()
  })
})
