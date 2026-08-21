import { fromAny } from '@total-typescript/shoehorn'
import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useWaveAudioPlayer } from './useWaveAudioPlayer'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useMediaControls: () => ({
      playing: ref(false),
      currentTime: ref(0),
      duration: ref(0)
    })
  }
})

const mockFetchApi = vi.fn()
const originalAudioContext = globalThis.AudioContext

afterEach(() => {
  globalThis.AudioContext = originalAudioContext
  mockFetchApi.mockReset()
})

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (route: string) => '/api' + route,
    fetchApi: (...args: unknown[]) => mockFetchApi(...args)
  }
}))

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

    mockFetchApi.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: { get: () => 'audio/wav' }
    })

    const src = ref('/api/view?filename=audio.wav&type=output')
    const { bars, loading } = useWaveAudioPlayer({ src, barCount: 10 })

    await vi.waitFor(() => {
      expect(loading.value).toBe(false)
    })

    expect(mockFetchApi).toHaveBeenCalledWith(
      '/view?filename=audio.wav&type=output'
    )
    expect(mockDecodeAudioData).toHaveBeenCalled()
    expect(bars.value).toHaveLength(10)
  })

  it('does not call decodeAudioSource when src is empty', () => {
    const src = ref('')
    useWaveAudioPlayer({ src })
    expect(mockFetchApi).not.toHaveBeenCalled()
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
    mockFetchApi.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
    })
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

  it('skips the waveform fetch entirely when waveform is disabled', () => {
    const src = ref('/audio.wav')
    const { loading } = useWaveAudioPlayer({ src, waveform: false })

    expect(mockFetchApi).not.toHaveBeenCalled()
    expect(loading.value).toBe(false)
  })
})
