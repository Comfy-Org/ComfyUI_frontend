import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { usePreferredReducedMotion } from '@vueuse/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import LoopingVideo from './LoopingVideo.vue'

vi.mock(import('@vueuse/core'), { spy: true })

const WEBM = 'https://example.test/clip.webm'
const MP4 = 'https://example.test/clip.mp4'
const POSTER = 'https://example.test/clip.jpg'

function renderVideo(props: ComponentProps<typeof LoopingVideo> = {}) {
  render(LoopingVideo, {
    props,
    attrs: { 'data-testid': 'clip' },
    slots: { fallback: '<p>No video</p>' },
    global: { plugins: [i18n] }
  })
}

function sources() {
  return [...screen.getByTestId('clip').querySelectorAll('source')]
}

describe('LoopingVideo', () => {
  afterEach(() => {
    vi.mocked(usePreferredReducedMotion).mockRestore()
  })

  it('offers the webm first and the mp4 second, over the poster', () => {
    renderVideo({ webmSrc: WEBM, mp4Src: MP4, posterSrc: POSTER })

    expect(screen.getByTestId('clip')).toHaveAttribute('poster', POSTER)
    expect(
      sources().map((source) => [source.getAttribute('src'), source.type])
    ).toEqual([
      [WEBM, 'video/webm'],
      [MP4, 'video/mp4']
    ])
  })

  it('keeps playing the mp4 when the webm fails, and falls back once the mp4 fails too', async () => {
    renderVideo({ webmSrc: WEBM, mp4Src: MP4 })
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
    renderVideo({ webmSrc: WEBM })

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

      renderVideo({ webmSrc: WEBM })

      expect(screen.getByTestId('clip')).toHaveProperty('autoplay', autoplay)
    }
  )

  it('pauses a playing video when the user switches to reduced motion', async () => {
    const preference = ref<'reduce' | 'no-preference'>('no-preference')
    vi.mocked(usePreferredReducedMotion).mockReturnValue(
      computed(() => preference.value)
    )
    renderVideo({ webmSrc: WEBM })
    const video = screen.getByTestId<HTMLVideoElement>('clip')
    await video.play()
    expect(video.paused).toBe(false)

    preference.value = 'reduce'
    await nextTick()

    expect(video.paused).toBe(true)
  })

  it('offers no playback control unless it is pausable', () => {
    renderVideo({ webmSrc: WEBM })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('pauses and resumes from its control', async () => {
    const user = userEvent.setup()
    renderVideo({ webmSrc: WEBM, pausable: true })
    const video = screen.getByTestId<HTMLVideoElement>('clip')

    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(video.paused).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(video.paused).toBe(true)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })
})
