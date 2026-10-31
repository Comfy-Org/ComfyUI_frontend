import { fromAny } from '@total-typescript/shoehorn'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useMediaControls } from '@vueuse/core'
import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useWaveAudioPlayer } from './useWaveAudioPlayer'
import { useToast } from '@/components/ui/toast/toastStore'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { api } from '@/scripts/api'

vi.mock(import('@vueuse/core'), { spy: true })

const originalAudioContext = globalThis.AudioContext

beforeEach(() => {
  vi.mocked(api.apiURL).mockImplementation((route) => `/api${route}`)
  vi.mocked(useMediaControls).mockImplementation(() =>
    fromAny({
      playing: ref(false),
      currentTime: ref(0),
      duration: ref(0)
    })
  )
})

afterEach(() => {
  globalThis.AudioContext = originalAudioContext
})

vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'))

describe('useWaveAudioPlayer', () => {
  it('initializes with default bar count', () => {
    const src = ref('')
    const { bars } = useWaveAudioPlayer({ src })
    expect(bars.value).toHaveLength(40)
  })

  it('initializes with custom bar count', () => {
    const src = ref('')
    const { bars } = useWaveAudioPlayer({ src, barCount: 20 })
    expect(bars.value).toHaveLength(20)
  })

  it('returns playedBarIndex as -1 when duration is 0', () => {
    const src = ref('')
    const { playedBarIndex } = useWaveAudioPlayer({ src })
    expect(playedBarIndex.value).toBe(-1)
  })

  it('generates bars with heights between 10 and 70', () => {
    const src = ref('')
    const { bars } = useWaveAudioPlayer({ src })
    for (const bar of bars.value) {
      expect(bar.height).toBeGreaterThanOrEqual(10)
      expect(bar.height).toBeLessThanOrEqual(70)
    }
  })

  it('starts in paused state', () => {
    const src = ref('')
    const { isPlaying } = useWaveAudioPlayer({ src })
    expect(isPlaying.value).toBe(false)
  })

  it('shows 0:00 for formatted times initially', () => {
    const src = ref('')
    const { formattedCurrentTime, formattedDuration } = useWaveAudioPlayer({
      src
    })
    expect(formattedCurrentTime.value).toBe('0:00')
    expect(formattedDuration.value).toBe('0:00')
  })

  it('fetches and decodes audio when src changes', async () => {
    const mockAudioBuffer = {
      getChannelData: vi.fn(() => new Float32Array(80))
    }

    const mockDecodeAudioData = vi.fn(() => Promise.resolve(mockAudioBuffer))
    const mockClose = vi.fn().mockResolvedValue(undefined)
    globalThis.AudioContext = fromAny<typeof AudioContext, unknown>(
      class {
        decodeAudioData = mockDecodeAudioData
        close = mockClose
      }
    )

    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(new ArrayBuffer(8), {
        headers: { 'Content-Type': 'audio/wav' }
      })
    )

    const src = ref('/api/view?filename=audio.wav&type=output')
    const { bars, loading } = useWaveAudioPlayer({ src, barCount: 10 })

    await vi.waitFor(() => {
      expect(loading.value).toBe(false)
    })

    expect(api.fetchApi).toHaveBeenCalledWith(
      '/view?filename=audio.wav&type=output'
    )
    expect(mockDecodeAudioData).toHaveBeenCalled()
    expect(bars.value).toHaveLength(10)
  })

  it('does not call decodeAudioSource when src is empty', () => {
    const src = ref('')
    useWaveAudioPlayer({ src })
    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  function mockDecodedChannel(channel: Float32Array) {
    globalThis.AudioContext = fromAny<typeof AudioContext, unknown>(
      class {
        decodeAudioData = vi.fn(() =>
          Promise.resolve({ getChannelData: () => channel })
        )
        close = vi.fn().mockResolvedValue(undefined)
      }
    )
    vi.mocked(api.fetchApi).mockResolvedValue(new Response(new ArrayBuffer(8)))
  }

  it('renders silence as the minimum-height floor', async () => {
    mockDecodedChannel(new Float32Array(80))

    const src = ref('/audio.wav')
    const { bars, loading } = useWaveAudioPlayer({ src, barCount: 10 })
    await vi.waitFor(() => expect(loading.value).toBe(false))

    for (const bar of bars.value) {
      expect(bar.height).toBe(8)
    }
  })

  it('renders constant-amplitude audio as uniform full bars', async () => {
    mockDecodedChannel(new Float32Array(80).fill(0.5))

    const src = ref('/audio.wav')
    const { bars, loading } = useWaveAudioPlayer({ src, barCount: 10 })
    await vi.waitFor(() => expect(loading.value).toBe(false))

    for (const bar of bars.value) {
      expect(bar.height).toBe(100)
    }
  })

  it('normalizes bars for audio with real dynamic range', async () => {
    const channel = new Float32Array(80)
    channel.fill(1, 40)
    mockDecodedChannel(channel)

    const src = ref('/audio.wav')
    const { bars, loading } = useWaveAudioPlayer({ src, barCount: 10 })
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(bars.value[0].height).toBe(8)
    expect(bars.value[9].height).toBe(100)
  })

  it('re-decodes when the source is cleared and set again', async () => {
    mockDecodedChannel(new Float32Array(80))

    const src = ref<string | undefined>()
    useWaveAudioPlayer({ src, barCount: 10 })

    src.value = '/audio.wav'
    await nextTick()
    expect(api.fetchApi).toHaveBeenCalledTimes(1)

    src.value = undefined
    await nextTick()

    src.value = '/audio.wav'
    await nextTick()

    expect(api.fetchApi).toHaveBeenCalledTimes(2)
  })

  it('skips the waveform fetch entirely when waveform is disabled', () => {
    const src = ref('/audio.wav')
    const { loading } = useWaveAudioPlayer({ src, waveform: false })

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(loading.value).toBe(false)
  })

  describe('playback', () => {
    const notSupported = () =>
      new DOMException('The operation is not supported.', 'NotSupportedError')

    type Player = ReturnType<typeof useWaveAudioPlayer>

    async function createPlayer() {
      vi.mocked(useMediaControls).mockReset()

      const src = ref('')
      const player = useWaveAudioPlayer({ src, waveform: false })
      const audio = document.createElement('audio')
      audio.src = 'http://example.com/audio.ogg'
      player.audioRef.value = audio
      await nextTick()
      return { audio, player, src }
    }

    function giveDuration(audio: HTMLAudioElement) {
      Object.defineProperty(audio, 'duration', { value: 10 })
      audio.dispatchEvent(new Event('durationchange'))
      return nextTick()
    }

    it.for([
      ['the toggle', (p) => p.togglePlayPause()],
      ['the waveform', (p) => p.handleWaveformClick(new MouseEvent('click'))]
    ] satisfies [string, (p: Player) => void][])(
      'stays paused and shows a toast when play() rejects from %s',
      async ([, trigger]) => {
        const { audio, player } = await createPlayer()
        vi.spyOn(audio, 'play').mockRejectedValue(notSupported())
        const waveform = document.createElement('div')
        waveform.getBoundingClientRect = () => new DOMRect(0, 0, 100, 10)
        player.waveformRef.value = waveform
        await giveDuration(audio)

        trigger(player)

        await vi.waitFor(() =>
          expect(useToast().toasts).toEqual([
            expect.objectContaining({
              kind: 'error',
              description: enMessages.g.audioPlaybackFailed
            })
          ])
        )
        expect(player.isPlaying.value).toBe(false)
        expect(reportError).toHaveBeenCalledWith(
          expect.any(DOMException),
          expect.objectContaining({ errorType: 'error_playing_audio' })
        )
      }
    )

    it('dismisses the error toast after a successful retry', async () => {
      const { audio, player } = await createPlayer()
      vi.spyOn(audio, 'play')
        .mockRejectedValueOnce(notSupported())
        .mockResolvedValueOnce(undefined)

      player.togglePlayPause()
      await vi.waitFor(() => expect(useToast().toasts).toHaveLength(1))

      player.togglePlayPause()
      await vi.waitFor(() => expect(useToast().toasts).toEqual([]))
    })

    it('dismisses the error toast when the source changes', async () => {
      const { audio, player, src } = await createPlayer()
      vi.spyOn(audio, 'play').mockRejectedValue(notSupported())

      player.togglePlayPause()
      await vi.waitFor(() => expect(useToast().toasts).toHaveLength(1))

      src.value = 'http://example.com/other.mp3'
      await nextTick()

      expect(useToast().toasts).toEqual([])
    })

    it('keeps the error toast through a same-source retry cycle', async () => {
      vi.mocked(useMediaControls).mockReset()
      const src = ref<string | undefined>('http://example.com/a.ogg')
      const player = useWaveAudioPlayer({
        src,
        logicalSrc: ref('http://example.com/a.ogg'),
        waveform: false
      })
      const audio = document.createElement('audio')
      player.audioRef.value = audio
      await nextTick()
      vi.spyOn(audio, 'play').mockRejectedValue(notSupported())
      player.togglePlayPause()
      await vi.waitFor(() => expect(useToast().toasts).toHaveLength(1))

      src.value = undefined
      await nextTick()
      src.value = 'http://example.com/a.ogg'
      await nextTick()

      expect(useToast().toasts).toHaveLength(1)
    })

    it('dismisses the error toast when the source is cleared', async () => {
      const { audio, player, src } = await createPlayer()
      src.value = 'http://example.com/a.ogg'
      await nextTick()
      vi.spyOn(audio, 'play').mockRejectedValue(notSupported())
      player.togglePlayPause()
      await vi.waitFor(() => expect(useToast().toasts).toHaveLength(1))

      src.value = ''
      await nextTick()

      expect(useToast().toasts).toEqual([])
    })

    it('reloads a failed source before retrying', async () => {
      const { audio, player } = await createPlayer()
      let mediaError: { code: number } | null = { code: 4 }
      Object.defineProperty(audio, 'error', { get: () => mediaError })
      const load = vi.spyOn(audio, 'load').mockImplementation(() => {
        mediaError = null
      })
      vi.spyOn(audio, 'play').mockImplementation(() =>
        mediaError ? Promise.reject(notSupported()) : Promise.resolve()
      )

      player.togglePlayPause()
      await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
      await nextTick()
      await nextTick()

      expect(useToast().toasts).toEqual([])
    })

    it('reports failures on the caller surface', async () => {
      vi.mocked(useMediaControls).mockReset()
      const player = useWaveAudioPlayer({
        src: ref(''),
        surface: 'agent',
        waveform: false
      })
      const audio = document.createElement('audio')
      player.audioRef.value = audio
      await nextTick()
      vi.spyOn(audio, 'play').mockRejectedValue(notSupported())

      player.togglePlayPause()

      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(
          expect.any(DOMException),
          expect.objectContaining({ surface: 'agent' })
        )
      )
    })

    it('resumes from a waveform click right after a pause', async () => {
      const { audio, player } = await createPlayer()
      const play = vi.spyOn(audio, 'play').mockResolvedValue(undefined)
      const waveform = document.createElement('div')
      waveform.getBoundingClientRect = () => new DOMRect(0, 0, 100, 10)
      player.waveformRef.value = waveform
      await giveDuration(audio)
      audio.dispatchEvent(new Event('play'))
      await nextTick()
      expect(player.isPlaying.value).toBe(true)

      player.handleWaveformClick(new MouseEvent('click'))

      expect(play).toHaveBeenCalledTimes(1)
    })

    it('stays silent when a play attempt is aborted', async () => {
      const { audio, player } = await createPlayer()
      const play = vi
        .spyOn(audio, 'play')
        .mockRejectedValue(new DOMException('Aborted', 'AbortError'))

      player.togglePlayPause()
      await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1))
      await nextTick()
      await nextTick()

      expect(reportError).not.toHaveBeenCalled()
      expect(useToast().toasts).toEqual([])
    })

    it('ignores a rejection from an attempt the user already paused', async () => {
      const { audio, player } = await createPlayer()
      let rejectPlay: (reason: unknown) => void = () => {}
      vi.spyOn(audio, 'play').mockImplementation(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectPlay = reject
          })
      )

      player.togglePlayPause()
      Object.defineProperty(audio, 'paused', {
        value: false,
        configurable: true
      })
      player.togglePlayPause()
      rejectPlay(notSupported())
      await nextTick()
      await nextTick()

      expect(reportError).not.toHaveBeenCalled()
      expect(useToast().toasts).toEqual([])
    })

    it('pauses the element when a pending source fails to load', async () => {
      const { audio, player } = await createPlayer()
      vi.spyOn(audio, 'play').mockRejectedValue(notSupported())
      const pause = vi.spyOn(audio, 'pause').mockImplementation(() => {})

      player.togglePlayPause()

      await vi.waitFor(() => expect(pause).toHaveBeenCalled())
    })

    it('dismisses the error toast when its scope is disposed', async () => {
      vi.mocked(useMediaControls).mockReset()
      const scope = effectScope()
      const player = scope.run(() => useWaveAudioPlayer({ src: ref('') }))!
      const audio = document.createElement('audio')
      player.audioRef.value = audio
      await nextTick()
      vi.spyOn(audio, 'play').mockRejectedValue(notSupported())

      player.togglePlayPause()
      await vi.waitFor(() => expect(useToast().toasts).toHaveLength(1))

      scope.stop()

      expect(useToast().toasts).toEqual([])
    })

    it('pauses an element that is already playing', async () => {
      const { audio, player } = await createPlayer()
      Object.defineProperty(audio, 'paused', { value: false })
      const pause = vi.spyOn(audio, 'pause').mockImplementation(() => {})

      player.togglePlayPause()

      expect(pause).toHaveBeenCalledTimes(1)
    })
  })
})
