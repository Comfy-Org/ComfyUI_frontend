// @vitest-environment happy-dom
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import type * as LottieModule from 'lottie-web'

import LottieScene from './LottieScene.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock(import('../../composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => motion.reduced
}))

const lottie = vi.hoisted(() => {
  const animation = {
    play: vi.fn(),
    pause: vi.fn(),
    goToAndStop: vi.fn(),
    destroy: vi.fn()
  }
  return { animation, loadAnimation: vi.fn(() => animation) }
})

// lottie-web types loadAnimation as returning a full AnimationItem, so the
// partial stub is checked against the surface LottieScene actually calls.
interface MockAnimation {
  play: () => void
  pause: () => void
  goToAndStop: (value: number, isFrame?: boolean) => void
  destroy: () => void
}
interface MockLottie {
  loadAnimation: (...args: never[]) => MockAnimation
}

const lottieMock = {
  loadAnimation: lottie.loadAnimation
} satisfies MockLottie

vi.mock(import('lottie-web'), () => ({
  default: lottieMock as unknown as typeof LottieModule.default
}))

async function renderScene(props: { src: string; active?: boolean }) {
  const utils = render(LottieScene, { props })
  await setAllIntersecting(true)
  await vi.advanceTimersByTimeAsync(10)
  return utils
}

describe('LottieScene', () => {
  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
  })

  it('loads the animation lazily once on screen, then plays it', async () => {
    render(LottieScene, { props: { src: '/animations/s1/scene-01.json' } })
    expect(lottie.loadAnimation).not.toHaveBeenCalled()

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(10)

    expect(lottie.loadAnimation).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        path: '/animations/s1/scene-01.json',
        assetsPath: '/animations/s1/images/',
        loop: true,
        autoplay: false
      })
    )
    expect(lottie.animation.play).toHaveBeenCalled()
  })

  it('pauses while the owning slide is inactive and resumes with it', async () => {
    const { rerender } = await renderScene({
      src: '/animations/s1/scene-01.json',
      active: true
    })

    await rerender({ src: '/animations/s1/scene-01.json', active: false })
    expect(lottie.animation.pause).toHaveBeenCalled()

    lottie.animation.play.mockClear()
    await rerender({ src: '/animations/s1/scene-01.json', active: true })
    expect(lottie.animation.play).toHaveBeenCalled()
  })

  it('holds the first frame under prefers-reduced-motion', async () => {
    motion.reduced = true
    await renderScene({ src: '/animations/s1/scene-01.json' })

    expect(lottie.animation.goToAndStop).toHaveBeenCalledWith(0, true)
    expect(lottie.animation.play).not.toHaveBeenCalled()
  })

  it('destroys the animation when unmounted', async () => {
    const { unmount } = await renderScene({
      src: '/animations/s1/scene-01.json'
    })

    unmount()
    expect(lottie.animation.destroy).toHaveBeenCalled()
  })
})
