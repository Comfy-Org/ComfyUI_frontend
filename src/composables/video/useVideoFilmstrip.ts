import { onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { fetchVideoMetadata } from '@/utils/videoMetadataUtil'

export const DEFAULT_VIDEO_FPS = 20
export const FILMSTRIP_SAMPLE_COUNT = 5
export const FILMSTRIP_THUMBNAIL_HEIGHT = 96
export const FILMSTRIP_THUMBNAIL_MAX_WIDTH = 384

const METADATA_EVENT_TIMEOUT_MS = 15000
const SEEK_EVENT_TIMEOUT_MS = 5000

export type FilmstripError = 'canvas-unavailable' | 'load-failed'

interface UseVideoFilmstripOptions {
  fps?: number
  sampleCount?: number
}

class EventTimeoutError extends Error {}
class LoadAbortedError extends Error {}

function waitForEvent(
  target: EventTarget,
  eventName: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Event> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LoadAbortedError(`Aborted waiting for ${eventName}`))
      return
    }
    const onSuccess = (event: Event) => {
      cleanup()
      resolve(event)
    }
    const onError = () => {
      cleanup()
      reject(new Error(`Failed to load ${eventName}`))
    }
    const onAbort = () => {
      cleanup()
      reject(new LoadAbortedError(`Aborted waiting for ${eventName}`))
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new EventTimeoutError(`Timed out waiting for ${eventName}`))
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      target.removeEventListener(eventName, onSuccess)
      target.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
    }
    target.addEventListener(eventName, onSuccess, { once: true })
    target.addEventListener('error', onError, { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => resolve('')
    reader.readAsDataURL(blob)
  })
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? blobToDataUrl(blob) : ''),
      'image/jpeg',
      0.7
    )
  })
}

async function captureFrameViaBitmap(
  video: HTMLVideoElement,
  width: number,
  height: number
): Promise<string> {
  const bitmap = await createImageBitmap(video, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high'
  })
  const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height)
  const offscreenContext = offscreen.getContext('2d')
  if (!offscreenContext) {
    bitmap.close()
    return ''
  }
  offscreenContext.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await offscreen.convertToBlob({
    type: 'image/jpeg',
    quality: 0.7
  })
  return blobToDataUrl(blob)
}

function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
): Promise<string> {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  if (sourceWidth <= 0 || sourceHeight <= 0) return Promise.resolve('')

  const scale = Math.min(
    FILMSTRIP_THUMBNAIL_HEIGHT / sourceHeight,
    FILMSTRIP_THUMBNAIL_MAX_WIDTH / sourceWidth,
    1
  )
  const width = Math.max(Math.round(sourceWidth * scale), 1)
  const height = Math.max(Math.round(sourceHeight * scale), 1)

  if (
    typeof createImageBitmap === 'function' &&
    typeof OffscreenCanvas === 'function'
  ) {
    return captureFrameViaBitmap(video, width, height).catch(() => '')
  }

  canvas.width = width
  canvas.height = height
  context.drawImage(video, 0, 0, width, height)
  return canvasToJpegDataUrl(canvas)
}

async function sampleFilmstripFrames(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  duration: number,
  sampleCount: number,
  isStale: () => boolean,
  signal: AbortSignal
): Promise<string[]> {
  const pendingThumbnails: Promise<string>[] = []

  for (let index = 0; index < sampleCount; index++) {
    if (isStale()) break
    const time = (duration * (index + 0.5)) / sampleCount
    const target = Math.min(time, Math.max(duration - 0.001, 0))
    const alreadyAtTarget =
      Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2
    video.currentTime = target
    if (!alreadyAtTarget) {
      try {
        await waitForEvent(video, 'seeked', SEEK_EVENT_TIMEOUT_MS, signal)
      } catch (waitError) {
        if (waitError instanceof EventTimeoutError) {
          pendingThumbnails.push(Promise.resolve(''))
          continue
        }
        throw waitError
      }
    }
    pendingThumbnails.push(captureFrame(video, canvas, context))
  }

  return Promise.all(pendingThumbnails)
}

export function useVideoFilmstrip(
  videoUrl: Ref<string | undefined>,
  options: UseVideoFilmstripOptions = {}
) {
  const sampleCount = options.sampleCount ?? FILMSTRIP_SAMPLE_COUNT

  const thumbnails = ref<string[]>([])
  const duration = ref(0)
  const totalFrames = ref(0)
  const width = ref(0)
  const height = ref(0)
  const fps = ref(options.fps ?? DEFAULT_VIDEO_FPS)
  const fileSize = ref<number | undefined>()
  const loading = ref(false)
  const error = ref<FilmstripError | null>(null)

  let activeLoadId = 0
  let activeAbort: AbortController | undefined

  function isLoadStale(loadId: number, url: string) {
    return loadId !== activeLoadId || videoUrl.value !== url
  }

  function cancelActiveLoad() {
    activeLoadId++
    activeAbort?.abort()
    activeAbort = undefined
  }

  function resetVideoState() {
    thumbnails.value = []
    duration.value = 0
    totalFrames.value = 0
    width.value = 0
    height.value = 0
    fps.value = options.fps ?? DEFAULT_VIDEO_FPS
    fileSize.value = undefined
  }

  async function loadVideo(url: string) {
    activeAbort?.abort()
    const abortController = new AbortController()
    activeAbort = abortController
    const signal = abortController.signal

    const loadId = ++activeLoadId
    loading.value = true
    error.value = null
    thumbnails.value = []

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) {
      loading.value = false
      error.value = 'canvas-unavailable'
      resetVideoState()
      if (activeAbort === abortController) {
        activeAbort = undefined
      }
      return
    }

    try {
      video.src = url
      await waitForEvent(
        video,
        'loadedmetadata',
        METADATA_EVENT_TIMEOUT_MS,
        signal
      )

      if (isLoadStale(loadId, url)) return

      const videoDuration = Number.isFinite(video.duration) ? video.duration : 0
      duration.value = videoDuration
      width.value = video.videoWidth
      height.value = video.videoHeight

      const metadata = await fetchVideoMetadata(url, signal)

      if (isLoadStale(loadId, url)) return

      const effectiveDuration = metadata?.duration ?? videoDuration
      duration.value = effectiveDuration
      width.value = metadata?.width ?? video.videoWidth
      height.value = metadata?.height ?? video.videoHeight
      fps.value = metadata?.fps ?? options.fps ?? DEFAULT_VIDEO_FPS
      fileSize.value = metadata?.size
      totalFrames.value =
        metadata?.frame_count ??
        Math.max(Math.round(effectiveDuration * fps.value), 1)

      const sampledThumbnails = await sampleFilmstripFrames(
        video,
        canvas,
        context,
        effectiveDuration,
        sampleCount,
        () => isLoadStale(loadId, url),
        signal
      )

      if (isLoadStale(loadId, url)) return

      thumbnails.value = sampledThumbnails
    } catch (loadError) {
      if (loadError instanceof LoadAbortedError) return
      if (isLoadStale(loadId, url)) return
      error.value = 'load-failed'
      resetVideoState()
    } finally {
      if (loadId === activeLoadId) {
        loading.value = false
      }
      if (activeAbort === abortController) {
        activeAbort = undefined
      }
      video.removeAttribute('src')
      video.load()
    }
  }

  watch(
    videoUrl,
    (url) => {
      if (!url) {
        cancelActiveLoad()
        loading.value = false
        error.value = null
        resetVideoState()
        return
      }
      void loadVideo(url)
    },
    { immediate: true }
  )

  function retry() {
    const url = videoUrl.value
    if (url) void loadVideo(url)
  }

  onScopeDispose(cancelActiveLoad)

  return {
    thumbnails,
    duration,
    totalFrames,
    width,
    height,
    fps,
    fileSize,
    loading,
    error,
    retry
  }
}
