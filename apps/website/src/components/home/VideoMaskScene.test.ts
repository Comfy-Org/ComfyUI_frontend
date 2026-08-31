// @vitest-environment happy-dom
/* eslint-disable testing-library/no-node-access */
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import VideoMaskScene from './VideoMaskScene.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => motion.reduced
}))

/** 3s comp at 30fps: video A frames [0,45), video B [45,80), a dead gap to 90.
 * The outer position eases; the mask grows linearly for the first second. */
const FIXTURE = {
  fps: 30,
  duration: 90,
  compW: 1056,
  compH: 784,
  scenes: [
    {
      outerSt: 0,
      outerPos: [
        { t: 0, v: [528, 392], eo: [0.33, 0] },
        { t: 60, v: [628, 392], ei: [0.67, 1] }
      ],
      maskPos: [{ t: 0, v: [528, 392] }],
      maskSize: [
        { t: 0, v: [400, 300] },
        { t: 30, v: [600, 300] }
      ],
      maskRadius: 24,
      maskGroupOffset: [0, 0],
      videos: [
        {
          src: 'a.webm',
          ip: 0,
          op: 45,
          st: 0,
          scale: [{ t: 0, v: [100, 100] }],
          pos: [{ t: 0, v: [528, 392] }]
        },
        {
          src: 'b.webm',
          ip: 45,
          op: 80,
          st: 45,
          scale: [{ t: 0, v: [50, 50] }],
          pos: []
        }
      ]
    },
    {
      outerSt: 10,
      outerPos: [{ t: 0, v: [400, 300] }],
      maskPos: [{ t: 0, v: [200, 150] }],
      maskSize: [{ t: 0, v: [100, 100] }],
      maskRadius: 12,
      maskGroupOffset: [10, 10],
      videos: [
        {
          src: 'https://media.comfy.org/website/clips/c.webm',
          ip: 0,
          op: 90,
          st: 0,
          scale: [{ t: 0, v: [100, 100] }],
          pos: [{ t: 0, v: [528, 392] }]
        }
      ]
    }
  ]
}

function stubFetchWith(body: unknown) {
  const fetchMock = vi.fn(async () => ({ json: async () => body }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function mountScene(props: { src: string; active?: boolean }) {
  const utils = render(VideoMaskScene, { props })
  const root = utils.container.firstElementChild as HTMLElement
  Object.defineProperty(root, 'clientWidth', { value: 528 })
  Object.defineProperty(root, 'clientHeight', { value: 392 })
  return { ...utils, root }
}

function activeVideos(root: HTMLElement): string[] {
  return [...root.querySelectorAll('video.is-active')].map(
    (video) => (video as HTMLVideoElement).src
  )
}

describe('VideoMaskScene', () => {
  let play: ReturnType<typeof vi.spyOn>
  let pause: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
    play = vi
      .spyOn(HTMLVideoElement.prototype, 'play')
      .mockResolvedValue(undefined)
    pause = vi
      .spyOn(HTMLVideoElement.prototype, 'pause')
      .mockImplementation(() => {})
  })

  it('loads the scene once visible and plays the first active layer', async () => {
    const fetchMock = stubFetchWith(FIXTURE)
    const { root } = await mountScene({ src: '/animations/x/scene.json' })

    expect(fetchMock).not.toHaveBeenCalled()

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(10)

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      '/animations/x/scene.json'
    )
    // Relative clips resolve against the descriptor's assets/ sibling
    // directory; absolute CDN URLs pass through unchanged.
    const sources = [...root.querySelectorAll('video')].map((v) =>
      v.getAttribute('src')
    )
    expect(sources).toEqual([
      '/animations/x/assets/a.webm',
      '/animations/x/assets/b.webm',
      'https://media.comfy.org/website/clips/c.webm'
    ])

    // The second scene starts 10 frames later, so only scene one is live yet.
    expect(activeVideos(root)).toHaveLength(1)
    expect(play).toHaveBeenCalled()

    // The stage is scaled to cover the (stubbed) 528x392 root: 0.5.
    const stage = root.firstElementChild as HTMLElement
    expect(stage.style.transform).toBe('translate(-50%, -50%) scale(0.5)')

    // Mask box laid out at frame 0: centred 400x300 at the shared anchor.
    const sceneBox = root.querySelector('.vms-scene') as HTMLElement
    expect(sceneBox.style.width).toBe('400px')
    expect(sceneBox.style.height).toBe('300px')
    expect(sceneBox.style.borderRadius).toBe('24px')

    await vi.advanceTimersByTimeAsync(500)
    expect(activeVideos(root)).toHaveLength(2)
  })

  it('switches layers as the playhead crosses their windows and loops', async () => {
    stubFetchWith(FIXTURE)
    const { root } = await mountScene({ src: '/animations/x/scene.json' })
    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(10)

    const [first, second] = [...root.querySelectorAll('video')] as [
      HTMLVideoElement,
      HTMLVideoElement
    ]
    expect(first.classList.contains('is-active')).toBe(true)
    expect(second.classList.contains('is-active')).toBe(false)

    // Past frame 45 (1.5s): layer B takes over and A pauses.
    await vi.advanceTimersByTimeAsync(1800)
    expect(first.classList.contains('is-active')).toBe(false)
    expect(second.classList.contains('is-active')).toBe(true)
    expect(pause).toHaveBeenCalled()

    // Frames 80-90 are a gap with no live window.
    await vi.advanceTimersByTimeAsync(1000)
    expect(first.classList.contains('is-active')).toBe(false)
    expect(second.classList.contains('is-active')).toBe(false)

    // The master clock wraps at the comp duration and layer A returns.
    await vi.advanceTimersByTimeAsync(700)
    expect(first.classList.contains('is-active')).toBe(true)
  })

  it('pauses off screen and while the owning slide is inactive', async () => {
    stubFetchWith(FIXTURE)
    const { root, rerender } = await mountScene({
      src: '/animations/x/scene.json'
    })
    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(10)
    play.mockClear()
    pause.mockClear()

    await setAllIntersecting(false)
    await vi.advanceTimersByTimeAsync(10)
    expect(pause).toHaveBeenCalled()

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(10)
    expect(play).toHaveBeenCalled()

    pause.mockClear()
    await rerender({ src: '/animations/x/scene.json', active: false })
    await vi.advanceTimersByTimeAsync(10)
    expect(pause).toHaveBeenCalled()
    expect(root.querySelector('video')).toBeTruthy()
  })

  it('never plays under prefers-reduced-motion', async () => {
    motion.reduced = true
    stubFetchWith(FIXTURE)
    await mountScene({ src: '/animations/x/scene.json' })
    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(100)

    expect(play).not.toHaveBeenCalled()
  })

  it('retries the descriptor fetch after a failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ json: async () => FIXTURE })
    vi.stubGlobal('fetch', fetchMock)

    const { root } = await mountScene({ src: '/animations/x/scene.json' })
    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(10)
    expect(root.querySelector('video')).toBeNull()

    // The next visibility change may start a fresh load.
    await setAllIntersecting(false)
    await vi.advanceTimersByTimeAsync(10)
    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(10)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(root.querySelector('video')).toBeTruthy()
  })
})
