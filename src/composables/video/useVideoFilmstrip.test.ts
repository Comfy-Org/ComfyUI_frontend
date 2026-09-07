import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchVideoMetadata } from '@/utils/videoMetadataUtil'

import {
  DEFAULT_VIDEO_FPS,
  FILMSTRIP_THUMBNAIL_HEIGHT,
  FILMSTRIP_THUMBNAIL_MAX_WIDTH,
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
  shouldEmitSeeked: (value: number) => boolean = () => true
  private _currentTime = 0
  private listeners = new Map<string, Set<VideoListener>>()

  get currentTime() {
    return this._currentTime
  }

  set currentTime(value: number) {
    const changed = value !== this._currentTime
    this._currentTime = value
    if (
      (changed || this.emitSeekedOnSameValue) &&
      this.shouldEmitSeeked(value)
    ) {
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
    const { thumbnail, totalFrames, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    videoUrl.value = undefined
    await nextTick()

    expect(thumbnail.value).toBe('')
    expect(totalFrames.value).toBe(0)
    expect(loading.value).toBe(false)
  })

  it('uses backend metadata when available', async () => {
    installVideoMocks()
    vi.mocked(fetchVideoMetadata).mockResolvedValueOnce({
      fps: 24,
      duration: 10,
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
    installVideoMocks({
      onVideoCreated: (video) => {
        video.duration = Infinity
      }
    })
    vi.mocked(fetchVideoMetadata).mockResolvedValueOnce({
      fps: 24,
      duration: 8,
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
  })

  it('recovers the duration of videos that report a non-finite duration', async () => {
    installVideoMocks({
      onVideoCreated: (video) => {
        video.duration = Infinity
        video.addEventListener('seeked', () => {
          if (video.currentTime > 1000) {
            video.duration = 12
          }
        })
      }
    })

    const videoUrl = ref('https://example.com/recording.mp4')
    const { duration, totalFrames, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(duration.value).toBe(12)
    expect(totalFrames.value).toBe(Math.round(12 * DEFAULT_VIDEO_FPS))
  })

  it('captures a single thumbnail past any black intro frames', async () => {
    let seekCount = 0
    const seekTargets: number[] = []
    installVideoMocks({
      onVideoCreated: (video) => {
        video.addEventListener('seeked', () => {
          seekCount += 1
          seekTargets.push(video.currentTime)
        })
      }
    })

    const videoUrl = ref('https://example.com/video.mp4')
    const { thumbnail, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(seekCount).toBe(1)
    expect(seekTargets).toEqual([1])
    expect(thumbnail.value).not.toBe('')
  })

  it('captures without seeking when the frame is already at the target', async () => {
    let seekCount = 0
    installVideoMocks({
      onVideoCreated: (video) => {
        video.shouldEmitSeeked = () => false
        video.currentTime = 1
        video.shouldEmitSeeked = () => true
        video.readyState = 2
        video.addEventListener('seeked', () => {
          seekCount += 1
        })
      }
    })

    const videoUrl = ref('https://example.com/video.mp4')
    const { thumbnail, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(seekCount).toBe(0)
    expect(thumbnail.value).not.toBe('')
  })

  it('still completes when the first-frame seek times out', async () => {
    installVideoMocks({
      onVideoCreated: (video) => {
        video.shouldEmitSeeked = () => false
      }
    })

    const videoUrl = ref('https://example.com/video.mp4')
    const { error, loading } = runWithScope(() => useVideoFilmstrip(videoUrl))

    await vi.advanceTimersByTimeAsync(6000)
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(error.value).toBeNull()
  })

  it('captures the thumbnail via createImageBitmap when available', async () => {
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
    const { thumbnail, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(thumbnail.value).not.toBe('')
    expect(createImageBitmapMock).toHaveBeenCalledTimes(1)
    expect(createImageBitmapMock).toHaveBeenCalledWith(expect.anything(), {
      resizeWidth: Math.round(1920 * (FILMSTRIP_THUMBNAIL_HEIGHT / 1080)),
      resizeHeight: FILMSTRIP_THUMBNAIL_HEIGHT,
      resizeQuality: 'high'
    })
    expect(bitmap.close).toHaveBeenCalledTimes(1)
  })

  it('leaves the thumbnail empty when every capture attempt fails', async () => {
    const createImageBitmapMock = vi.fn(async () => {
      throw new Error('decode failed')
    })
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas)
    installVideoMocks()

    const videoUrl = ref('https://example.com/video.mp4')
    const { thumbnail, error, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.advanceTimersByTimeAsync(6000)
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(createImageBitmapMock.mock.calls.length).toBeGreaterThan(1)
    expect(thumbnail.value).toBe('')
    expect(error.value).toBeNull()

    const attemptsAtTimeout = createImageBitmapMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(createImageBitmapMock.mock.calls.length).toBe(attemptsAtTimeout)
  })

  it('stops polling for a frame when the load is superseded', async () => {
    const bitmap = { width: 171, height: 96, close: vi.fn() }
    const videos: MockVideoElement[] = []
    const createImageBitmapMock = vi.fn(async () => {
      if (videos.length === 1) throw new Error('decode failed')
      return bitmap
    })
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas)
    installVideoMocks({
      onVideoCreated: (video) => {
        videos.push(video)
      }
    })

    const videoUrl = ref('https://example.com/first.mp4')
    const { thumbnail, error, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )
    await vi.advanceTimersByTimeAsync(500)
    const attemptsBeforeSwitch = createImageBitmapMock.mock.calls.length
    expect(attemptsBeforeSwitch).toBeGreaterThan(1)

    videoUrl.value = 'https://example.com/second.mp4'
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(videos[0].src).toBe('')
    expect(error.value).toBeNull()
    expect(thumbnail.value).not.toBe('')

    const attemptsAfterSettle = createImageBitmapMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(createImageBitmapMock.mock.calls.length).toBe(attemptsAfterSettle)
  })

  it('retries the capture when the frame is not yet decodable', async () => {
    const bitmap = { width: 171, height: 96, close: vi.fn() }
    const createImageBitmapMock = vi
      .fn(async () => bitmap)
      .mockRejectedValueOnce(new Error('The image source is not usable.'))
      .mockRejectedValueOnce(new Error('The image source is not usable.'))
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas)
    installVideoMocks()

    const videoUrl = ref('https://example.com/video.mp4')
    const { thumbnail, loading } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.advanceTimersByTimeAsync(3000)
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(createImageBitmapMock).toHaveBeenCalledTimes(3)
    expect(thumbnail.value).not.toBe('')
  })

  it('downscales the captured thumbnail to the filmstrip height', async () => {
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

  it('keeps the thumbnail at source size when the video is smaller than the filmstrip height', async () => {
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

  it('caps thumbnail width for ultra-wide sources', async () => {
    let canvas: HTMLCanvasElement | undefined
    installVideoMocks({
      onVideoCreated: (video) => {
        video.videoWidth = 1920
        video.videoHeight = 64
      },
      onCanvasCreated: (created) => {
        canvas = created
      }
    })

    const videoUrl = ref('https://example.com/strip.mp4')
    const { loading } = runWithScope(() => useVideoFilmstrip(videoUrl))

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(canvas?.width).toBe(FILMSTRIP_THUMBNAIL_MAX_WIDTH)
    expect(canvas?.height).toBe(
      Math.round(64 * (FILMSTRIP_THUMBNAIL_MAX_WIDTH / 1920))
    )
  })

  it('reloads the current video when retry is called after a failure', async () => {
    const videos: MockVideoElement[] = []
    installVideoMocks({
      onVideoCreated: (video) => {
        video.autoEmitMetadata = videos.length > 0
        if (videos.length === 0) {
          queueMicrotask(() => video.emit('error'))
        }
        videos.push(video)
      }
    })

    const videoUrl = ref('https://example.com/video.mp4')
    const { thumbnail, error, loading, retry } = runWithScope(() =>
      useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(error.value).toBe('load-failed'))

    retry()
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(error.value).toBeNull()
    expect(thumbnail.value).not.toBe('')
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
    const { error, duration, totalFrames, thumbnail, loading } = runWithScope(
      () => useVideoFilmstrip(videoUrl)
    )

    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(error.value).toBe('load-failed')
    expect(duration.value).toBe(0)
    expect(totalFrames.value).toBe(0)
    expect(thumbnail.value).toBe('')
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
