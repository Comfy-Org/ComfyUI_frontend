import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { probeVideoFrameRate } from '@/composables/video/probeVideoFrameRate'
import { fetchHttpResourceByteSize } from '@/utils/httpResourceByteSize'

import {
  DEFAULT_VIDEO_FPS,
  FILMSTRIP_SAMPLE_COUNT,
  useVideoFilmstrip
} from './useVideoFilmstrip'

vi.mock('@/composables/video/probeVideoFrameRate', () => ({
  probeVideoFrameRate: vi.fn(async () => undefined)
}))

vi.mock('@/utils/httpResourceByteSize', () => ({
  fetchHttpResourceByteSize: vi.fn(async () => undefined)
}))

type VideoListener = (event: Event) => void

class MockVideoElement {
  preload = ''
  muted = false
  playsInline = false
  crossOrigin = ''
  duration = 10
  videoWidth = 512
  videoHeight = 512
  src = ''
  private listeners = new Map<string, Set<VideoListener>>()

  set currentTime(_value: number) {
    queueMicrotask(() => this.emit('seeked'))
  }

  addEventListener(type: string, listener: VideoListener, options?: boolean) {
    if (options === true) {
      const wrapped = (event: Event) => {
        this.removeEventListener(type, wrapped)
        listener(event)
      }
      this.getListeners(type).add(wrapped)
      return
    }
    this.getListeners(type).add(listener)
  }

  removeEventListener(type: string, listener: VideoListener) {
    this.getListeners(type).delete(listener)
  }

  load() {
    this.src = ''
  }

  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }

  private getListeners(type: string) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    return this.listeners.get(type)!
  }

  emit(type: string) {
    for (const listener of [...this.getListeners(type)]) {
      listener(new Event(type))
    }
  }
}

function createMockCanvas(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: vi.fn()
    }),
    toDataURL: () => 'data:image/jpeg;base64,thumb'
  } as unknown as HTMLCanvasElement
}

function installVideoMocks() {
  const originalCreateElement = document.createElement.bind(document)

  vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
    if (tagName === 'video') {
      const video = new MockVideoElement()
      queueMicrotask(() => video.emit('loadedmetadata'))
      return video as unknown as HTMLVideoElement
    }
    if (tagName === 'canvas') {
      return createMockCanvas()
    }
    return originalCreateElement(tagName)
  })
}

describe('useVideoFilmstrip', () => {
  let scope: EffectScope | undefined

  function runWithScope<T>(fn: () => T): T {
    scope = effectScope()
    return scope.run(fn)!
  }

  afterEach(() => {
    scope?.stop()
    scope = undefined
    vi.restoreAllMocks()
  })

  it('estimates total frames from duration and default fps', async () => {
    installVideoMocks()

    const videoUrl = ref('https://example.com/video.mp4')
    const { totalFrames, duration, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(duration.value).toBe(10)
    expect(totalFrames.value).toBe(Math.round(10 * DEFAULT_VIDEO_FPS))
  })

  it('clears state when url is removed', async () => {
    installVideoMocks()

    const videoUrl = ref<string | undefined>('https://example.com/video.mp4')
    const { thumbnails, totalFrames, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    videoUrl.value = undefined
    await nextTick()

    expect(thumbnails.value).toEqual([])
    expect(totalFrames.value).toBe(0)
    expect(loading.value).toBe(false)
  })

  it('uses probed frame rate and file size when available', async () => {
    installVideoMocks()
    vi.mocked(probeVideoFrameRate).mockResolvedValueOnce(24)
    vi.mocked(fetchHttpResourceByteSize).mockResolvedValueOnce(5 * 1024 * 1024)

    const videoUrl = ref('https://example.com/video.mp4')
    const { totalFrames, fps, fileSize, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(fps.value).toBe(24)
    expect(totalFrames.value).toBe(240)
    expect(fileSize.value).toBe(5 * 1024 * 1024)
  })

  it('samples the configured number of frames', async () => {
    let seekCount = 0
    const originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'video') {
        const video = new MockVideoElement()
        video.addEventListener('seeked', () => {
          seekCount += 1
        })
        queueMicrotask(() => video.emit('loadedmetadata'))
        return video as unknown as HTMLVideoElement
      }
      if (tagName === 'canvas') {
        return createMockCanvas()
      }
      return originalCreateElement(tagName)
    })

    const videoUrl = ref('https://example.com/video.mp4')
    const { thumbnails, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl, {
        sampleCount: FILMSTRIP_SAMPLE_COUNT
      })
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(seekCount).toBe(FILMSTRIP_SAMPLE_COUNT)
    expect(thumbnails.value).toHaveLength(FILMSTRIP_SAMPLE_COUNT)
  })
})
