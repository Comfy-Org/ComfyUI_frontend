import type { Ref } from 'vue'
import { nextTick, ref } from 'vue'

import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

export const DEFAULT_VIDEO_WIDTH = 640
export const DEFAULT_VIDEO_HEIGHT = 480

interface UseWebcamCaptureOptions {
  videoRef: Ref<HTMLVideoElement | undefined>
  readonly?: boolean
  onCameraStart?: () => void
}

interface UseWebcamCaptureReturn {
  // State
  isCameraOn: Ref<boolean>
  isShowingPreview: Ref<boolean>
  isInitializingCamera: Ref<boolean>
  stream: Ref<MediaStream | null>
  capturedImageUrl: Ref<string | null>
  lastUploadedPath: Ref<string | null>

  // Methods
  startCameraPreview: () => Promise<void>
  stopCameraPreview: () => void
  restartCameraPreview: () => Promise<void>
  stopStreamTracks: () => void
  capturePhoto: (node: LGraphNode) => string | null
  uploadImage: (dataUrl: string, node: LGraphNode) => Promise<string | null>
  clearCapturedImage: () => void

  // Lifecycle
  initializeElements: () => void
  cleanup: () => void
}

export function useWebcamCapture(
  options: UseWebcamCaptureOptions
): UseWebcamCaptureReturn {
  const { videoRef, readonly, onCameraStart } = options

  // State
  const isCameraOn = ref(false)
  const isShowingPreview = ref(false)
  const isInitializingCamera = ref(false)
  const stream = ref<MediaStream | null>(null)
  const capturedImageUrl = ref<string | null>(null)
  const lastUploadedPath = ref<string | null>(null)

  // Instance-specific elements
  const canvas = ref<HTMLCanvasElement | null>(null)
  const persistentVideo = ref<HTMLVideoElement | null>(null)

  // Track pending video event listeners for cleanup
  const pendingVideoCleanup = ref<(() => void) | null>(null)

  function initializeElements() {
    canvas.value = document.createElement('canvas')
    persistentVideo.value = document.createElement('video')
    persistentVideo.value.autoplay = true
    persistentVideo.value.muted = true
    persistentVideo.value.playsInline = true
  }

  function cleanup() {
    pendingVideoCleanup.value?.()
    stopStreamTracks()

    if (persistentVideo.value) {
      persistentVideo.value.srcObject = null
      persistentVideo.value = null
    }
    canvas.value = null
  }

  function stopStreamTracks() {
    if (!stream.value) return
    stream.value.getTracks().forEach((track) => track.stop())
    stream.value = null
    isCameraOn.value = false
  }

  function stopCameraPreview() {
    isShowingPreview.value = false
  }

  async function restartCameraPreview() {
    stopStreamTracks()
    isShowingPreview.value = false
    await startCameraPreview()
  }

  function clearCapturedImage() {
    capturedImageUrl.value = null
    lastUploadedPath.value = null
  }

  async function startCameraPreview() {
    if (readonly) return

    // Prevent concurrent camera initialization attempts
    if (isInitializingCamera.value) return
    isInitializingCamera.value = true

    capturedImageUrl.value = null

    try {
      if (isCameraOn.value && stream.value && stream.value.active) {
        isShowingPreview.value = true
        await nextTick()

        if (videoRef.value && stream.value) {
          videoRef.value.srcObject = stream.value
          await videoRef.value.play()
        }

        // Ensure persistent video also has the stream for background capture
        if (
          persistentVideo.value &&
          (!persistentVideo.value.srcObject || persistentVideo.value.paused)
        ) {
          persistentVideo.value.srcObject = stream.value
          await persistentVideo.value.play()
        }

        return
      }

      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })

      stream.value = cameraStream
      // Attach stream to persistent video for capture when UI video is hidden
      if (persistentVideo.value) {
        persistentVideo.value.srcObject = cameraStream
        await persistentVideo.value.play()
      }
      isShowingPreview.value = true
      await nextTick()

      if (videoRef.value) {
        videoRef.value.srcObject = cameraStream

        await new Promise<void>((resolve, reject) => {
          if (!videoRef.value) {
            reject(new Error('Video element not found'))
            return
          }

          const video = videoRef.value

          const cleanupListeners = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            video.removeEventListener('error', onError)
            pendingVideoCleanup.value = null
          }

          const onLoadedMetadata = () => {
            cleanupListeners()
            resolve()
          }

          const onError = (error: Event) => {
            cleanupListeners()
            reject(error)
          }

          video.addEventListener('loadedmetadata', onLoadedMetadata)
          video.addEventListener('error', onError)

          // Store cleanup function for onUnmounted
          pendingVideoCleanup.value = cleanupListeners

          setTimeout(() => {
            cleanupListeners()
            resolve()
          }, 1000)
        })

        await videoRef.value.play()
      }

      isCameraOn.value = true
      onCameraStart?.()
      await nextTick()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      if (window.isSecureContext) {
        useToastStore().addAlert(
          t('g.unableToLoadWebcam', { error: errorMessage })
        )
      } else {
        useToastStore().addAlert(
          t('g.webcamRequiresTLS', { error: errorMessage })
        )
      }

      stopStreamTracks()
      isShowingPreview.value = false
    } finally {
      isInitializingCamera.value = false
    }
  }

  function capturePhoto(node: LGraphNode): string | null {
    if (!node) return null

    // Use visible video element if available, otherwise use persistent video
    const videoElement =
      videoRef.value ?? (stream.value?.active ? persistentVideo.value : null)
    if (!videoElement || !canvas.value) return null

    const widthWidget = node.widgets?.find((w) => w.name === 'width')
    const heightWidget = node.widgets?.find((w) => w.name === 'height')

    const width = (widthWidget?.value as number) || DEFAULT_VIDEO_WIDTH
    const height = (heightWidget?.value as number) || DEFAULT_VIDEO_HEIGHT

    canvas.value.width = width
    canvas.value.height = height

    const ctx = canvas.value.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(videoElement, 0, 0, width, height)
    return canvas.value.toDataURL('image/png')
  }

  async function uploadImage(
    dataUrl: string,
    node: LGraphNode
  ): Promise<string | null> {
    try {
      if (!canvas.value) throw new Error('Canvas not initialized')

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.value!.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Failed to convert canvas to blob'))
        })
      })

      const name = `${+new Date()}.png`
      const file = new File([blob], name)
      const body = new FormData()
      body.append('image', file)
      body.append('subfolder', 'webcam')
      body.append('type', 'temp')

      const resp = await api.fetchApi('/upload/image', {
        method: 'POST',
        body
      })

      if (resp.status !== 200) {
        const err = `Error uploading camera image: ${resp.status} - ${resp.statusText}`
        useToastStore().addAlert(err)
        throw new Error(err)
      }

      const uploadedPath = `webcam/${name} [temp]`
      lastUploadedPath.value = uploadedPath

      const img = new Image()
      img.onload = () => {
        node.imgs = [img]
        app.graph.setDirtyCanvas(true)
      }
      img.src = dataUrl

      return uploadedPath
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      useToastStore().addAlert(
        t('g.errorCapturingImage', { error: errorMessage })
      )
      return null
    }
  }

  return {
    // State
    isCameraOn,
    isShowingPreview,
    isInitializingCamera,
    stream,
    capturedImageUrl,
    lastUploadedPath,

    // Methods
    startCameraPreview,
    stopCameraPreview,
    restartCameraPreview,
    stopStreamTracks,
    capturePhoto,
    uploadImage,
    clearCapturedImage,

    // Lifecycle
    initializeElements,
    cleanup
  }
}
