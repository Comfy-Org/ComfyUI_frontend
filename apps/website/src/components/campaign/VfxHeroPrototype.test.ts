import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert, beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import VfxHeroPrototype from './VfxHeroPrototype.vue'

import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => motion.reduced
}))

beforeEach(() => {
  motion.reduced = false
  vi.stubGlobal(
    'HTMLMediaElement',
    class extends HTMLMediaElement {
      static override readonly HAVE_METADATA = 1
    }
  )
})

async function renderReadyHero(locale: 'en' | 'zh-CN' = 'en') {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const observers = stubIntersectionObserver()
  render(VfxHeroPrototype, {
    props: {
      locale,
      contactHref: '/contact/',
      source: 'diner',
      variants: [
        { id: 'relight_golden', label: 'Golden hour' },
        { id: 'relight_night', label: 'Night' }
      ]
    }
  })
  await nextTick()
  const surface = screen.getByTestId('video-compare-surface')
  const observer = observers.instances.find((item) =>
    item.observed.includes(surface)
  )
  assert.exists(observer)
  const bounds = new DOMRect(0, 0, 400, 225)
  observer.callback(
    [
      {
        target: surface,
        boundingClientRect: bounds,
        intersectionRect: bounds,
        rootBounds: null,
        isIntersecting: true,
        intersectionRatio: 1,
        time: 0
      }
    ],
    new IntersectionObserver(() => undefined)
  )
  await nextTick()
  const beforeVideo = screen.getByTestId<HTMLVideoElement>(
    'video-compare-before'
  )
  const afterVideo = screen.getByTestId<HTMLVideoElement>('video-compare-after')
  vi.spyOn(beforeVideo, 'readyState', 'get').mockReturnValue(3)
  vi.spyOn(beforeVideo, 'duration', 'get').mockReturnValue(8)
  beforeVideo.dispatchEvent(new Event('loadedmetadata'))
  prepareResult(afterVideo)
  await nextTick()
  return { beforeVideo, afterVideo }
}

function prepareResult(video: HTMLVideoElement) {
  vi.spyOn(video, 'readyState', 'get').mockReturnValue(3)
  vi.spyOn(video, 'duration', 'get').mockReturnValue(8)
  video.dispatchEvent(new Event('loadedmetadata'))
}

it('keeps both hero clips paused after selecting another sample', async () => {
  const user = userEvent.setup()
  const { beforeVideo, afterVideo } = await renderReadyHero()
  await waitFor(() => expect(beforeVideo.paused).toBe(false))
  screen.getByRole('button', { name: /^Pause$/ }).focus()
  await user.keyboard(' ')
  await waitFor(() => {
    expect(beforeVideo.paused).toBe(true)
    expect(afterVideo.paused).toBe(true)
  })

  await user.click(screen.getByRole('button', { name: /^Night$/ }))
  const selectedVideo = screen.getByTestId<HTMLVideoElement>(
    'video-compare-after'
  )
  prepareResult(selectedVideo)
  await nextTick()

  expect(beforeVideo.paused).toBe(true)
  expect(selectedVideo.paused).toBe(true)
  expect(screen.getByRole('button', { name: /^Play$/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

it('lets reduced-motion visitors play both clips and keeps that choice after selection', async () => {
  const user = userEvent.setup()
  motion.reduced = true
  const { beforeVideo, afterVideo } = await renderReadyHero('zh-CN')
  expect(beforeVideo.paused).toBe(true)
  screen.getByRole('button', { name: /^播放$/ }).focus()
  await user.keyboard(' ')
  await waitFor(() => {
    expect(beforeVideo.paused).toBe(false)
    expect(afterVideo.paused).toBe(false)
  })

  await user.click(screen.getByRole('button', { name: /^Night$/ }))
  const selectedVideo = screen.getByTestId<HTMLVideoElement>(
    'video-compare-after'
  )
  prepareResult(selectedVideo)

  await waitFor(() => {
    expect(beforeVideo.paused).toBe(false)
    expect(selectedVideo.paused).toBe(false)
  })
  expect(screen.getByRole('button', { name: /^暂停$/ })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
})

it('resumes a new hero sample after a media failure when the visitor has not paused', async () => {
  const user = userEvent.setup()
  const { beforeVideo, afterVideo } = await renderReadyHero()
  await waitFor(() => expect(afterVideo.paused).toBe(false))
  afterVideo.dispatchEvent(new Event('error'))
  await waitFor(() => expect(beforeVideo.paused).toBe(true))

  await user.click(screen.getByRole('button', { name: /^Night$/ }))
  const selectedVideo = screen.getByTestId<HTMLVideoElement>(
    'video-compare-after'
  )
  prepareResult(selectedVideo)

  await waitFor(() => {
    expect(beforeVideo.paused).toBe(false)
    expect(selectedVideo.paused).toBe(false)
  })
})

it('does not move the comparison divider when playback is toggled', async () => {
  const user = userEvent.setup()
  await renderReadyHero()

  screen.getByRole('button', { name: /^Pause$/ }).focus()
  await user.keyboard(' ')

  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '50')
})
