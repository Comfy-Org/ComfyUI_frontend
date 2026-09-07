// @vitest-environment happy-dom
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import LottieScene from './LottieScene.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('../../composables/useReducedMotion', () => ({
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

vi.mock('lottie-web', () => ({
  default: { loadAnimation: lottie.loadAnimation }
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
