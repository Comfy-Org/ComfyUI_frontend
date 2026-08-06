import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchVideoMetadata } from '@/utils/videoMetadataUtil'

import {
  DEFAULT_VIDEO_FPS,
  FILMSTRIP_SAMPLE_COUNT,
  FILMSTRIP_THUMBNAIL_HEIGHT,
  useVideoFilmstrip
} from './useVideoFilmstrip'

vi.mock('@/utils/videoMetadataUtil', () => ({
  fetchVideoMetadata: vi.fn(async () => undefined)
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
  readyState = 0
  emitSeekedOnSameValue = true
  autoEmitMetadata = true
  private _currentTime = 0
  private listeners = new Map<string, Set<VideoListener>>()

  get currentTime() {
    return this._currentTime
  }

  set currentTime(value: number) {
    const changed = value !== this._currentTime
    this._currentTime = value
    if (changed || this.emitSeekedOnSameValue) {
      queueMicrotask(() => this.emit('seeked'))
    }
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

class MockOffscreenCanvas {
  constructor(
    public width: number,
    public height: number
  ) {}
  getContext() {
    return { drawImage: vi.fn() }
  }
  async convertToBlob() {
    return new Blob(['thumb'], { type: 'image/jpeg' })
  }
}

function createMockCanvas(context: unknown = { drawImage: vi.fn() }) {
  return {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: (callback: BlobCallback) =>
      callback(new Blob(['thumb'], { type: 'image/jpeg' }))
  } as unknown as HTMLCanvasElement
}

function installVideoMocks({
  onVideoCreated,
  onCanvasCreated,
  canvasContext = { drawImage: vi.fn() } as unknown
}: {
  onVideoCreated?: (video: MockVideoElement) => void
  onCanvasCreated?: (canvas: HTMLCanvasElement) => void
  canvasContext?: unknown
} = {}) {
  const originalCreateElement = document.createElement.bind(document)

  vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
    if (tagName === 'video') {
      const video = new MockVideoElement()
      onVideoCreated?.(video)
      if (video.autoEmitMetadata) {
        queueMicrotask(() => video.emit('loadedmetadata'))
      }
      return video as unknown as HTMLVideoElement
    }
    if (tagName === 'canvas') {
      const canvas = createMockCanvas(canvasContext)
      onCanvasCreated?.(canvas)
      return canvas
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

  it('uses backend metadata when available', async () => {
    installVideoMocks()
    vi.mocked(fetchVideoMetadata).mockResolvedValueOnce({
      fps: 24,
      duration: 10,
      frame_count: 240,
      width: 512,
      height: 512,
      size: 5 * 1024 * 1024
    })

    const videoUrl = ref('https://example.com/video.mp4')
    const { totalFrames, fps, fileSize, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(fps.value).toBe(24)
    expect(totalFrames.value).toBe(240)
    expect(fileSize.value).toBe(5 * 1024 * 1024)
    expect(fetchVideoMetadata).toHaveBeenCalledWith(
      'https://example.com/video.mp4',
      expect.any(AbortSignal)
    )
  })

  it('derives duration and dimensions from backend metadata when the element reports a non-finite duration', async () => {
    let maxSeekTarget = 0
    installVideoMocks({
      onVideoCreated: (video) => {
        video.duration = Infinity
        video.addEventListener('seeked', () => {
          maxSeekTarget = Math.max(maxSeekTarget, video.currentTime)
        })
      }
    })
    vi.mocked(fetchVideoMetadata).mockResolvedValueOnce({
      fps: 24,
      duration: 8,
      frame_count: null,
      width: 640,
      height: 360,
      size: 1024
    })

    const videoUrl = ref('https://example.com/fragmented.mp4')
    const { duration, width, height, totalFrames, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(duration.value).toBe(8)
    expect(width.value).toBe(640)
    expect(height.value).toBe(360)
    expect(totalFrames.value).toBe(Math.round(8 * 24))
    expect(maxSeekTarget).toBeGreaterThan(7)
  })

  it('samples the configured number of frames', async () => {
    let seekCount = 0
    installVideoMocks({
      onVideoCreated: (video) => {
        video.addEventListener('seeked', () => {
          seekCount += 1
        })
      }
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

  it('captures thumbnails via createImageBitmap when available', async () => {
    const bitmap = { width: 171, height: 96, close: vi.fn() }
    const createImageBitmapMock = vi.fn(
      async (_source: unknown, _options?: ImageBitmapOptions) => bitmap
    )
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas)

    installVideoMocks({
      onVideoCreated: (video) => {
        video.videoWidth = 1920
        video.videoHeight = 1080
      }
    })

    const videoUrl = ref('https://example.com/video.mp4')
    const { thumbnails, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(thumbnails.value).toHaveLength(FILMSTRIP_SAMPLE_COUNT)
    expect(createImageBitmapMock).toHaveBeenCalledWith(expect.anything(), {
      resizeWidth: Math.round(1920 * (FILMSTRIP_THUMBNAIL_HEIGHT / 1080)),
      resizeHeight: FILMSTRIP_THUMBNAIL_HEIGHT
    })
    expect(bitmap.close).toHaveBeenCalledTimes(FILMSTRIP_SAMPLE_COUNT)
  })

  it('downscales captured thumbnails to the filmstrip height', async () => {
    let canvas: HTMLCanvasElement | undefined
    installVideoMocks({
      onVideoCreated: (video) => {
        video.videoWidth = 1920
        video.videoHeight = 1080
      },
      onCanvasCreated: (created) => {
        canvas = created
      }
    })

    const videoUrl = ref('https://example.com/video.mp4')
    const { loading } = runWithScope(() => useVideoFilmstrip(videoUrl))

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(canvas?.height).toBe(FILMSTRIP_THUMBNAIL_HEIGHT)
    expect(canvas?.width).toBe(
      Math.round(1920 * (FILMSTRIP_THUMBNAIL_HEIGHT / 1080))
    )
  })

  it('keeps thumbnails at source size when the video is smaller than the filmstrip height', async () => {
    let canvas: HTMLCanvasElement | undefined
    installVideoMocks({
      onVideoCreated: (video) => {
        video.videoWidth = 64
        video.videoHeight = 64
      },
      onCanvasCreated: (created) => {
        canvas = created
      }
    })

    const videoUrl = ref('https://example.com/video.mp4')
    const { loading } = runWithScope(() => useVideoFilmstrip(videoUrl))

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(canvas?.width).toBe(64)
    expect(canvas?.height).toBe(64)
  })

  it('captures the first sample without a seeked event for same-position seeks', async () => {
    installVideoMocks({
      onVideoCreated: (video) => {
        video.readyState = 2
        video.emitSeekedOnSameValue = false
      }
    })

    const videoUrl = ref('https://example.com/video.mp4')
    const { thumbnails, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl, { sampleCount: 5 })
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(thumbnails.value).toHaveLength(5)
  })

  it('keeps a placeholder slot when a single thumbnail capture fails', async () => {
    const bitmap = { width: 171, height: 96, close: vi.fn() }
    let captureCalls = 0
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        captureCalls += 1
        if (captureCalls === 2) throw new Error('decode failed')
        return bitmap
      })
    )
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas)
    installVideoMocks()

    const videoUrl = ref('https://example.com/video.mp4')
    const { thumbnails, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(thumbnails.value).toHaveLength(FILMSTRIP_SAMPLE_COUNT)
    expect(thumbnails.value[1]).toBe('')
    expect(
      thumbnails.value.filter((thumbnail) => thumbnail !== '')
    ).toHaveLength(FILMSTRIP_SAMPLE_COUNT - 1)
  })

  it('aborts a superseded load so its video element is released immediately', async () => {
    const videos: MockVideoElement[] = []
    installVideoMocks({
      onVideoCreated: (video) => {
        video.autoEmitMetadata = videos.length > 0
        videos.push(video)
      }
    })

    const videoUrl = ref('https://example.com/first.mp4')
    const { loading } = runWithScope(() => useVideoFilmstrip(videoUrl))
    await nextTick()
    expect(videos[0].src).toBe('https://example.com/first.mp4')

    videoUrl.value = 'https://example.com/second.mp4'
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(videos[0].src).toBe('')
  })

  it('aborts the in-flight load when the scope is disposed', async () => {
    const videos: MockVideoElement[] = []
    installVideoMocks({
      onVideoCreated: (video) => {
        video.autoEmitMetadata = false
        videos.push(video)
      }
    })

    const videoUrl = ref('https://example.com/video.mp4')
    runWithScope(() => useVideoFilmstrip(videoUrl))
    await nextTick()
    expect(videos[0].src).toBe('https://example.com/video.mp4')

    scope!.stop()

    await vi.waitFor(() => expect(videos[0].src).toBe(''))
  })

  it('reports load-failed and resets state when the video errors', async () => {
    installVideoMocks({
      onVideoCreated: (video) => {
        video.autoEmitMetadata = false
        queueMicrotask(() => video.emit('error'))
      }
    })

    const videoUrl = ref('https://example.com/broken.mp4')
    const { error, duration, totalFrames, thumbnails, loading } = runWithScope(
      () => useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(error.value).toBe('load-failed')
    expect(duration.value).toBe(0)
    expect(totalFrames.value).toBe(0)
    expect(thumbnails.value).toEqual([])
  })

  it('reports canvas-unavailable when a 2d context cannot be created', async () => {
    installVideoMocks({ canvasContext: null })

    const videoUrl = ref('https://example.com/video.mp4')
    const { error, loading } = runWithScope(() => useVideoFilmstrip(videoUrl))

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(error.value).toBe('canvas-unavailable')
  })

  it('ignores results from a stale load after the url changes', async () => {
    const videos: MockVideoElement[] = []
    installVideoMocks({
      onVideoCreated: (video) => {
        video.duration = videos.length === 0 ? 5 : 10
        video.autoEmitMetadata = videos.length > 0
        videos.push(video)
      }
    })

    const videoUrl = ref('https://example.com/first.mp4')
    const { duration, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )
    await nextTick()

    videoUrl.value = 'https://example.com/second.mp4'
    await vi.waitFor(() => expect(loading.value).toBe(false))
    expect(duration.value).toBe(10)

    videos[0].emit('loadedmetadata')
    await nextTick()
    await nextTick()

    expect(duration.value).toBe(10)
    expect(loading.value).toBe(false)
  })
})
