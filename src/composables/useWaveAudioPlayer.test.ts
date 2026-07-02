import { fromAny } from '@total-typescript/shoehorn'
import { ref } from 'vue'
import type { Ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWaveAudioPlayer } from './useWaveAudioPlayer'

type MediaControls = {
  playing: Ref<boolean>
  currentTime: Ref<number>
  duration: Ref<number>
  volume: Ref<number>
  muted: Ref<boolean>
}

const mockMediaControls = vi.hoisted(() => ({
  values: [] as MediaControls[]
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useMediaControls: () =>
      mockMediaControls.values.shift() ?? {
        playing: ref(false),
        currentTime: ref(0),
        duration: ref(0),
        volume: ref(1),
        muted: ref(false)
      }
  }
})

const mockFetchApi = vi.fn()
const originalAudioContext = globalThis.AudioContext

function queueMediaControls(overrides: Partial<MediaControls> = {}) {
  const controls: MediaControls = {
    playing: ref(false),
    currentTime: ref(0),
    duration: ref(0),
    volume: ref(1),
    muted: ref(false),
    ...overrides
  }
  mockMediaControls.values.push(controls)
  return controls
}

beforeEach(() => {
  mockMediaControls.values = []
})

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

  it('computes progress and played bar when duration is known', () => {
    queueMediaControls({
      currentTime: ref(30),
      duration: ref(120)
    })
    const src = ref('')
    const { playedBarIndex, progressRatio } = useWaveAudioPlayer({
      src,
      barCount: 40
    })

    expect(playedBarIndex.value).toBe(9)
    expect(progressRatio.value).toBe(25)
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

  it('updates playback and seek controls', () => {
    const controls = queueMediaControls({
      currentTime: ref(10),
      duration: ref(100)
    })
    const src = ref('')
    const player = useWaveAudioPlayer({ src })

    player.togglePlayPause()
    expect(player.isPlaying.value).toBe(true)

    player.seekToStart()
    expect(controls.currentTime.value).toBe(0)

    player.seekToRatio(0.25)
    expect(controls.currentTime.value).toBe(25)

    player.seekToRatio(-1)
    expect(controls.currentTime.value).toBe(0)

    player.seekToRatio(2)
    expect(controls.currentTime.value).toBe(100)

    player.seekToEnd()
    expect(controls.currentTime.value).toBe(100)
    expect(player.isPlaying.value).toBe(false)
  })

  it('updates mute state and volume icon', () => {
    const controls = queueMediaControls({
      volume: ref(1),
      muted: ref(false)
    })
    const src = ref('')
    const player = useWaveAudioPlayer({ src })

    expect(player.volumeIcon.value).toBe('icon-[lucide--volume-2]')

    controls.volume.value = 0.25
    expect(player.volumeIcon.value).toBe('icon-[lucide--volume-1]')

    controls.volume.value = 0
    expect(player.volumeIcon.value).toBe('icon-[lucide--volume-x]')

    controls.volume.value = 1
    player.toggleMute()
    expect(controls.muted.value).toBe(true)
    expect(player.volumeIcon.value).toBe('icon-[lucide--volume-x]')
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

  it('uses placeholder bars when decoded audio has no channel data', async () => {
    const mockAudioBuffer = {
      getChannelData: vi.fn(() => new Float32Array())
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
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
    })
    const src = ref('/api/view?filename=empty.wav&type=output')
    const { bars, loading } = useWaveAudioPlayer({ src, barCount: 6 })

    await vi.waitFor(() => {
      expect(loading.value).toBe(false)
    })

    expect(bars.value).toHaveLength(6)
    for (const bar of bars.value) {
      expect(bar.height).toBeGreaterThanOrEqual(10)
      expect(bar.height).toBeLessThanOrEqual(70)
    }
  })

  it('uses placeholder bars when fetching audio fails', async () => {
    mockFetchApi.mockResolvedValue({
      ok: false,
      status: 500
    })
    const src = ref('https://example.com/audio.wav')
    const { bars, loading } = useWaveAudioPlayer({ src, barCount: 5 })

    await vi.waitFor(() => {
      expect(loading.value).toBe(false)
    })

    expect(mockFetchApi).toHaveBeenCalledWith('https://example.com/audio.wav')
    expect(bars.value).toHaveLength(5)
  })

  it('seeks from waveform clicks and starts playback', () => {
    const controls = queueMediaControls({
      duration: ref(100)
    })
    const src = ref('')
    const player = useWaveAudioPlayer({ src })

    player.handleWaveformClick(fromAny<MouseEvent, unknown>({ clientX: 50 }))
    expect(controls.currentTime.value).toBe(0)

    player.waveformRef.value = fromAny<HTMLElement, unknown>({
      getBoundingClientRect: () => ({ left: 10, width: 100 })
    })

    player.handleWaveformClick(fromAny<MouseEvent, unknown>({ clientX: 60 }))
    expect(controls.currentTime.value).toBe(50)
    expect(player.isPlaying.value).toBe(true)

    player.handleWaveformClick(fromAny<MouseEvent, unknown>({ clientX: -100 }))
    expect(controls.currentTime.value).toBe(0)

    player.handleWaveformClick(fromAny<MouseEvent, unknown>({ clientX: 999 }))
    expect(controls.currentTime.value).toBe(100)
  })

  it('ignores waveform clicks when duration is zero', () => {
    const controls = queueMediaControls()
    const src = ref('')
    const player = useWaveAudioPlayer({ src })
    player.waveformRef.value = fromAny<HTMLElement, unknown>({
      getBoundingClientRect: () => ({ left: 0, width: 100 })
    })

    player.handleWaveformClick(fromAny<MouseEvent, unknown>({ clientX: 50 }))

    expect(controls.currentTime.value).toBe(0)
    expect(player.isPlaying.value).toBe(false)
  })

  it('does not call decodeAudioSource when src is empty', () => {
    const src = ref('')
    useWaveAudioPlayer({ src })
    expect(mockFetchApi).not.toHaveBeenCalled()
  })
})
