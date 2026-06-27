import { onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'

export const DEFAULT_VIDEO_FPS = 20
export const FILMSTRIP_SAMPLE_COUNT = 20

interface UseVideoFilmstripOptions {
  fps?: number
  sampleCount?: number
}

function waitForEvent(target: EventTarget, eventName: string): Promise<Event> {
  return new Promise((resolve, reject) => {
    const onSuccess = (event: Event) => {
      cleanup()
      resolve(event)
    }
    const onError = () => {
      cleanup()
      reject(new Error(`Failed to load ${eventName}`))
    }
    const cleanup = () => {
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
  sampleCount: number
): Promise<string[]> {
  const thumbnails: string[] = []
  const lastIndex = Math.max(sampleCount - 1, 1)

  for (let index = 0; index < sampleCount; index++) {
    const time = sampleCount <= 1 ? 0 : (duration * index) / lastIndex
    video.currentTime = Math.min(time, Math.max(duration - 0.001, 0))
    await waitForEvent(video, 'seeked')
    const thumbnail = await captureFrame(video, canvas, context)
    if (thumbnail) thumbnails.push(thumbnail)
  }

  return thumbnails
}

export function useVideoFilmstrip(
  videoUrl: Ref<string | undefined>,
  options: UseVideoFilmstripOptions = {}
) {
  const fps = options.fps ?? DEFAULT_VIDEO_FPS
  const sampleCount = options.sampleCount ?? FILMSTRIP_SAMPLE_COUNT

  const thumbnails = ref<string[]>([])
  const duration = ref(0)
  const totalFrames = ref(0)
  const width = ref(0)
  const height = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let activeLoadId = 0

  function isLoadStale(loadId: number, url: string) {
    return loadId !== activeLoadId || videoUrl.value !== url
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
      error.value = 'Canvas is unavailable'
      return
    }

    try {
      video.src = url
      await waitForEvent(video, 'loadedmetadata')

      if (isLoadStale(loadId, url)) return

      const videoDuration = Number.isFinite(video.duration) ? video.duration : 0
      duration.value = videoDuration
      width.value = video.videoWidth
      height.value = video.videoHeight
      totalFrames.value = Math.max(Math.round(videoDuration * fps), 1)

      const sampledThumbnails = await sampleFilmstripFrames(
        video,
        canvas,
        context,
        videoDuration,
        sampleCount
      )

      if (isLoadStale(loadId, url)) return

      thumbnails.value = sampledThumbnails
    } catch (loadError) {
      if (isLoadStale(loadId, url)) return
      error.value =
        loadError instanceof Error ? loadError.message : 'Failed to load video'
      duration.value = 0
      totalFrames.value = 0
      width.value = 0
      height.value = 0
      thumbnails.value = []
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
        thumbnails.value = []
        duration.value = 0
        totalFrames.value = 0
        width.value = 0
        height.value = 0
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
    loading,
    error
  }
}
