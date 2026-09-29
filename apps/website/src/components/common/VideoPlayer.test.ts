import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import VideoPlayer from './VideoPlayer.vue'

describe('VideoPlayer', () => {
  it('shows Unmute once a lazily-autoplaying video is forced muted to start playback', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false)
    vi.spyOn(HTMLMediaElement.prototype, 'muted', 'get').mockReturnValue(false)
    vi.spyOn(HTMLMediaElement.prototype, 'muted', 'set').mockImplementation(
      () => {}
    )
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    render(VideoPlayer, {
      props: {
        src: 'https://example.com/clip.mp4',
        autoplay: true,
        lazyAutoplay: true,
        muteOnly: true
      }
    })

    expect(await screen.findByRole('button', { name: 'Unmute' })).toBeTruthy()
  })

  it('shows Mute once autoplay-unmuted playback succeeds', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false)
    vi.spyOn(HTMLMediaElement.prototype, 'muted', 'get').mockReturnValue(true)
    vi.spyOn(HTMLMediaElement.prototype, 'muted', 'set').mockImplementation(
      () => {}
    )
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)

    render(VideoPlayer, {
      props: {
        src: 'https://example.com/clip.mp4',
        autoplay: true,
        autoplayUnmuted: true,
        muteOnly: true
      }
    })

    await vi.waitFor(() => expect(play).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy()
  })

  // A server-rendered autoplay video can already be playing (and muted) when
  // hydration binds the element, after its play/volumechange events fired.
  // The element-bind watcher must sync the controls to that reality.
  it('syncs the corner controls with a video already playing muted when the element binds', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false)
    vi.spyOn(HTMLMediaElement.prototype, 'muted', 'get').mockReturnValue(true)

    render(VideoPlayer, {
      props: { src: 'https://example.com/clip.mp4', muteOnly: true }
    })

    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeTruthy()
  })

  it.for([
    { noCors: true, captions: false, tracks: [], crossOrigin: null },
    {
      noCors: true,
      captions: true,
      tracks: [
        {
          src: 'https://example.com/clip.vtt',
          kind: 'captions' as const,
          srclang: 'en',
          label: 'English'
        }
      ],
      crossOrigin: 'anonymous'
    },
    { noCors: false, captions: false, tracks: [], crossOrigin: 'anonymous' }
  ])(
    'requests CORS only when captions or the caller need it (noCors: $noCors, captions: $captions)',
    ({ noCors, tracks, crossOrigin }) => {
      render(VideoPlayer, {
        props: {
          src: 'https://storage.example/output.mp4',
          ariaLabel: 'Output',
          noCors,
          tracks
        }
      })
      const video = screen.getByLabelText('Output')
      if (!(video instanceof HTMLVideoElement))
        throw new Error('Expected the labelled video element')
      expect(video.crossOrigin).toBe(crossOrigin)
    }
  )

  // A pointer that hovers keeps the bar up for as long as it rests on the
  // player. A finger cannot: the window after playback starts is the whole of
  // the bar's visit, and 800ms was long enough to see the controls and too
  // short to hit one.
  it.for([
    { hover: true, after: 1000, reachable: false },
    { hover: false, after: 1000, reachable: true },
    { hover: false, after: 5000, reachable: false }
  ])(
    'leaves the bar reachable $reachable $after ms into playback (hover: $hover)',
    async ({ hover, after, reachable }) => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(hover: hover)' ? hover : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {}
      }))
      vi.useFakeTimers()
      onTestFinished(() => {
        vi.useRealTimers()
      })
      vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(
        false
      )
      render(VideoPlayer, {
        props: { src: 'https://example.com/clip.mp4', controlsOnHover: true }
      })

      // Playback starting is what summons the bar, and the only thing that does
      // on a device with no pointer to rest here.
      await vi.waitFor(() =>
        expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
      )
      vi.advanceTimersByTime(after)
      await nextTick()

      const bar = screen.getByTestId('player-control-bar')
      expect(bar.className.includes('pointer-events-none')).toBe(!reachable)
    }
  )

  it('shows play and mute for a paused, unmuted video', async () => {
    render(VideoPlayer, {
      props: { src: 'https://example.com/clip.mp4', muteOnly: true }
    })

    expect(await screen.findByRole('button', { name: 'Play' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy()
  })
})
