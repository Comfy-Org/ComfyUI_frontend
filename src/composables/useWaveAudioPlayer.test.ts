import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useWaveAudioPlayer } from './useWaveAudioPlayer'

vi.mock('@vueuse/core', () => ({
  useMediaControls: () => ({
    playing: ref(false),
    currentTime: ref(0),
    duration: ref(0)
  })
}))

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
    const mockArrayBuffer = new ArrayBuffer(8)
    const mockAudioBuffer = {
      getChannelData: vi.fn(() => new Float32Array(80))
    }

    const mockClose = vi.fn().mockResolvedValue(undefined)
    globalThis.AudioContext = vi.fn().mockImplementation(() => ({
      decodeAudioData: vi.fn(() => Promise.resolve(mockAudioBuffer)),
      close: mockClose
    })) as unknown as typeof AudioContext

    mockFetchApi.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      headers: { get: () => 'audio/wav' }
    })

    const src = ref('/api/view?filename=audio.wav&type=output')
    const { bars } = useWaveAudioPlayer({ src, barCount: 10 })

    await vi.waitFor(() => {
      expect(bars.value).toHaveLength(10)
      expect(mockFetchApi).toHaveBeenCalledWith(
        '/view?filename=audio.wav&type=output'
      )
    })
  })
})
