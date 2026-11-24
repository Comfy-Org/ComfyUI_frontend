import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { usePreferredReducedMotion } from '@vueuse/core'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import Video from './Video.vue'

vi.mock(import('@vueuse/core'), { spy: true })

const WEBM = 'https://example.test/clip.webm'
const MP4 = 'https://example.test/clip.mp4'
const POSTER = 'https://example.test/clip.jpg'

function renderVideo(props: ComponentProps<typeof Video> = {}) {
  render(Video, {
    props,
    attrs: { 'data-testid': 'clip' },
    slots: { fallback: '<p>No video</p>' }
  })
}

function sources() {
  return [...screen.getByTestId('clip').querySelectorAll('source')]
}

describe('Video', () => {
  it('offers its sources in order over the poster', () => {
    renderVideo({
      sources: [
        { src: WEBM, type: 'video/webm' },
        { src: MP4, type: 'video/mp4' }
      ],
      posterSrc: POSTER
    })

    expect(screen.getByTestId('clip')).toHaveAttribute('poster', POSTER)
    expect(
      sources().map((source) => [source.getAttribute('src'), source.type])
    ).toEqual([
      [WEBM, 'video/webm'],
      [MP4, 'video/mp4']
    ])
  })

  it.for([
    { given: 'a poster', posterSrc: POSTER, posters: [POSTER] },
    { given: 'no poster', posterSrc: '', posters: [] }
  ])(
    'shows $given over the video before any frame plays',
    ({ posterSrc, posters }) => {
      renderVideo({
        sources: [{ src: WEBM, type: 'video/webm' }],
        posterSrc,
        autoplay: true
      })

      expect(
        screen.queryAllByAltText('').map((image) => image.getAttribute('src'))
      ).toEqual(posters)
    }
  )

  it.for([
    { playback: 'starts at its first frame', currentTime: 0, posters: 1 },
    { playback: 'moves past its first frame', currentTime: 0.04, posters: 0 }
  ])(
    'shows $posters poster when playback $playback',
    async ({ currentTime, posters }) => {
      renderVideo({
        sources: [{ src: WEBM, type: 'video/webm' }],
        posterSrc: POSTER,
        autoplay: true
      })
      const video = screen.getByTestId<HTMLVideoElement>('clip')
      await video.play()

      video.currentTime = currentTime
      await fireEvent.timeUpdate(video)

      expect(screen.queryAllByAltText('')).toHaveLength(posters)
    }
  )

  it('shows the paused frame, not the poster, once a frame has played', async () => {
    renderVideo({
      sources: [{ src: WEBM, type: 'video/webm' }],
      posterSrc: POSTER,
      autoplay: true
    })
    const video = screen.getByTestId<HTMLVideoElement>('clip')
    await video.play()
    video.currentTime = 1
    await fireEvent.timeUpdate(video)

    video.pause()
    await nextTick()

    expect(screen.queryByAltText('')).not.toBeInTheDocument()
  })

  it('keeps playing the mp4 when the webm fails, and falls back once the mp4 fails too', async () => {
    renderVideo({
      sources: [
        { src: WEBM, type: 'video/webm' },
        { src: MP4, type: 'video/mp4' }
      ]
    })
    const [webm, mp4] = sources()

    await fireEvent.error(webm)
    expect(screen.getByTestId('clip')).toBeInTheDocument()
    expect(screen.queryByText('No video')).not.toBeInTheDocument()

    await fireEvent.error(mp4)
    expect(screen.queryByTestId('clip')).not.toBeInTheDocument()
    expect(screen.getByText('No video')).toBeInTheDocument()
  })

  it('shows the fallback when no video is supplied', () => {
    renderVideo()

    expect(screen.getByText('No video')).toBeInTheDocument()
  })

  it('falls back as soon as the webm fails when there is no mp4', async () => {
    renderVideo({ sources: [{ src: WEBM, type: 'video/webm' }] })

    await fireEvent.error(sources()[0])

    expect(screen.getByText('No video')).toBeInTheDocument()
  })

  it.for([
    { preference: 'no-preference', autoplay: true },
    { preference: 'reduce', autoplay: false }
  ] as const)(
    'autoplays only when motion is allowed ($preference)',
    ({ preference, autoplay }) => {
      vi.mocked(usePreferredReducedMotion).mockReturnValue(
        computed(() => preference)
      )

      renderVideo({
        sources: [{ src: WEBM, type: 'video/webm' }],
        autoplay: true
      })

      expect(screen.getByTestId('clip')).toHaveProperty('autoplay', autoplay)
    }
  )

  it('pauses a playing video when the user switches to reduced motion', async () => {
    const preference = ref<'reduce' | 'no-preference'>('no-preference')
    vi.mocked(usePreferredReducedMotion).mockReturnValue(
      computed(() => preference.value)
    )
    renderVideo({
      sources: [{ src: WEBM, type: 'video/webm' }],
      autoplay: true
    })
    const video = screen.getByTestId<HTMLVideoElement>('clip')
    await video.play()
    expect(video.paused).toBe(false)

    preference.value = 'reduce'
    await nextTick()

    expect(video.paused).toBe(true)
  })

  it('offers no playback control unless requested', () => {
    renderVideo({ sources: [{ src: WEBM, type: 'video/webm' }] })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('pauses and resumes from its control', async () => {
    const user = userEvent.setup()
    renderVideo({
      sources: [{ src: WEBM, type: 'video/webm' }],
      playbackLabels: { play: 'Play', pause: 'Pause' }
    })
    const video = screen.getByTestId<HTMLVideoElement>('clip')

    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(video.paused).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(video.paused).toBe(true)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it.for([false, true])('sets looping to $0 when requested', (loop) => {
    renderVideo({
      sources: [{ src: WEBM, type: 'video/webm' }],
      loop
    })

    expect(screen.getByTestId('clip')).toHaveProperty('loop', loop)
  })
})
