import { onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { fetchVideoMetadata } from '@/utils/videoMetadataUtil'

export const DEFAULT_VIDEO_FPS = 20
export const FILMSTRIP_SAMPLE_COUNT = 20

const METADATA_EVENT_TIMEOUT_MS = 15000
const SEEK_EVENT_TIMEOUT_MS = 5000

export type FilmstripError = 'canvas-unavailable' | 'load-failed'

interface UseVideoFilmstripOptions {
  fps?: number
  sampleCount?: number
}

class EventTimeoutError extends Error {}

function waitForEvent(
  target: EventTarget,
  eventName: string,
  timeoutMs: number
): Promise<Event> {
  return new Promise((resolve, reject) => {
    const onSuccess = (event: Event) => {
      cleanup()
      resolve(event)
    }
    const onError = () => {
      cleanup()
      reject(new Error(`Failed to load ${eventName}`))
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new EventTimeoutError(`Timed out waiting for ${eventName}`))
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      target.removeEventListener(eventName, onSuccess)
      target.removeEventListener('error', onError)
    }
    target.addEventListener(eventName, onSuccess, { once: true })
    target.addEventListener('error', onError, { once: true })
  })
}

async function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
): Promise<string> {
  const width = video.videoWidth
  const height = video.videoHeight
  if (width <= 0 || height <= 0) return ''

  canvas.width = width
  canvas.height = height
  context.drawImage(video, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', 0.7)
}

async function sampleFilmstripFrames(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  duration: number,
  sampleCount: number,
  isStale: () => boolean
): Promise<string[]> {
  const thumbnails: string[] = []
  const lastIndex = Math.max(sampleCount - 1, 1)

  for (let index = 0; index < sampleCount; index++) {
    if (isStale()) break
    const time = sampleCount <= 1 ? 0 : (duration * index) / lastIndex
    const target = Math.min(time, Math.max(duration - 0.001, 0))
    const alreadyAtTarget =
      Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2
    video.currentTime = target
    if (!alreadyAtTarget) {
      try {
        await waitForEvent(video, 'seeked', SEEK_EVENT_TIMEOUT_MS)
      } catch (waitError) {
        if (waitError instanceof EventTimeoutError) continue
        throw waitError
      }
    }
    const thumbnail = await captureFrame(video, canvas, context)
    if (thumbnail) thumbnails.push(thumbnail)
  }

  return thumbnails
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

  function isLoadStale(loadId: number, url: string) {
    return loadId !== activeLoadId || videoUrl.value !== url
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
      return
    }

    try {
      video.src = url
      await waitForEvent(video, 'loadedmetadata', METADATA_EVENT_TIMEOUT_MS)

      if (isLoadStale(loadId, url)) return

      const videoDuration = Number.isFinite(video.duration) ? video.duration : 0
      duration.value = videoDuration
      width.value = video.videoWidth
      height.value = video.videoHeight

      const metadata = await fetchVideoMetadata(url)

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
        () => isLoadStale(loadId, url)
      )

      if (isLoadStale(loadId, url)) return

      thumbnails.value = sampledThumbnails
    } catch {
      if (isLoadStale(loadId, url)) return
      error.value = 'load-failed'
      resetVideoState()
    } finally {
      if (loadId === activeLoadId) {
        loading.value = false
      }
      video.removeAttribute('src')
      video.load()
    }
  }

  watch(
    videoUrl,
    (url) => {
      if (!url) {
        activeLoadId++
        loading.value = false
        error.value = null
        resetVideoState()
        return
      }
      void loadVideo(url)
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    activeLoadId++
  })

  return {
    thumbnails,
    duration,
    totalFrames,
    width,
    height,
    fps,
    fileSize,
    loading,
    error
  }
}
