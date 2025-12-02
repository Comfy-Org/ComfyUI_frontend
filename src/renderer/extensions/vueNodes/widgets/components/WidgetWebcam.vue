<template>
  <div class="relative">
    <div v-if="capturedImageUrl" class="mb-4">
      <img
        :src="capturedImageUrl"
        class="w-full rounded-lg bg-node-component-surface"
        :alt="t('g.capturedImage', 'Captured Image')"
      />
    </div>

    <div v-else-if="!isShowingPreview" class="mb-4">
      <Button
        class="text-text-secondary w-full border-0 bg-component-node-widget-background hover:bg-secondary-background-hover"
        :disabled="readonly"
        @click="restartCameraPreview()"
      >
        {{ t('g.turnOnCamera', 'Turn on Camera') }}
      </Button>
    </div>

    <div v-else ref="videoContainerRef" class="relative mb-4">
      <video
        ref="videoRef"
        autoplay
        muted
        playsinline
        class="w-full rounded-lg bg-node-component-surface"
      />

      <div
        v-if="isHovered"
        class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-lg bg-black/50"
        @click="stopCameraPreview"
      >
        <div class="text-base-foreground mb-4 text-base">
          {{ t('g.clickToStopLivePreview', 'Click to stop live preview') }}
        </div>

        <div
          class="flex size-10 items-center justify-center rounded-full bg-destructive-background"
        >
          <svg
            class="size-4 text-white rounded-md"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="2"
              width="12"
              height="12"
              rx="1"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { Button } from 'primevue'
import {
  computed,
  markRaw,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  toRaw,
  watch
} from 'vue'

import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { nodeManager } = useVueNodeLifecycle()

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  readonly?: boolean
  nodeId: string
}>()

const isCameraOn = ref(false)
const isShowingPreview = ref(false)
const isInitializingCamera = ref(false)
const originalWidgets = ref<IBaseWidget[]>([])
const videoRef = ref<HTMLVideoElement>()
const videoContainerRef = ref<HTMLElement>()
const stream = ref<MediaStream | null>(null)
// Track pending video event listeners for cleanup
const pendingVideoCleanup = ref<(() => void) | null>(null)
const isHovered = useElementHover(videoContainerRef)
// Instance-specific elements for capture - created per component instance
const canvas = ref<HTMLCanvasElement | null>(null)
const persistentVideo = ref<HTMLVideoElement | null>(null)
const capturedImageUrl = ref<string | null>(null)
const lastUploadedPath = ref<string | null>(null)

const TOGGLED_WIDGET_NAMES = new Set(['height', 'width', 'capture_on_queue'])
const CAPTURE_WIDGET_NAME = 'capture'
const RETAKE_WIDGET_NAME = 'retake'
const DEFAULT_VIDEO_WIDTH = 640
const DEFAULT_VIDEO_HEIGHT = 480

type WidgetTransformer = (widgets: IBaseWidget[]) => IBaseWidget[]

interface WidgetUpdateOptions {
  dirtyCanvas?: boolean
}

const litegraphNode = computed(() => {
  if (!props.nodeId || !app.rootGraph) return null
  return app.rootGraph.getNodeById(props.nodeId) as LGraphNode | null
})

function withLitegraphNode<T>(handler: (node: LGraphNode) => T) {
  const node = litegraphNode.value
  if (!node) return null
  return handler(node)
}

function setNodeWidgets(
  node: LGraphNode,
  widgets: IBaseWidget[],
  options: WidgetUpdateOptions = {}
) {
  node.widgets = widgets.map((widget) => markRaw(widget))

  if (node.graph) {
    node.graph._version++
  }

  if (options.dirtyCanvas ?? true) {
    app.graph.setDirtyCanvas(true, true)
  }
}

function updateNodeWidgets(
  node: LGraphNode,
  transformer: WidgetTransformer,
  options: WidgetUpdateOptions = {}
) {
  const currentWidgets = node.widgets?.map((widget) => toRaw(widget)) ?? []
  const updatedWidgets = transformer(currentWidgets)
  setNodeWidgets(node, updatedWidgets, options)
}

function applyWidgetVisibility(
  widget: IBaseWidget,
  hidden: boolean
): IBaseWidget {
  if (!TOGGLED_WIDGET_NAMES.has(widget.name)) return widget

  if (widget.name === 'capture_on_queue') {
    // Mutate in place to preserve object identity for serializeValue closure
    widget.type = 'selectToggle'
    widget.label = 'Capture Image'
    // Default to false (Manual mode) - only set if undefined/null
    if (widget.value === undefined || widget.value === null) {
      widget.value = false
    }
    widget.options = {
      ...widget.options,
      hidden,
      values: [
        { label: 'On Run', value: true },
        { label: 'Manually', value: false }
      ]
    }
    return widget
  }

  // For width/height, mutate options in place
  widget.options = {
    ...widget.options,
    hidden
  }
  return widget
}

interface ActionWidgetConfig {
  name: string
  label: string
  iconClass: string
  onClick: () => void
}

function createActionWidget({
  name,
  label,
  iconClass,
  onClick
}: ActionWidgetConfig): IBaseWidget {
  return {
    name,
    label,
    type: 'button',
    value: undefined,
    y: 100,
    options: {
      iconClass,
      serialize: false,
      hidden: false
    },
    callback: onClick
  }
}

function updateCaptureButtonVisibility(isOnRunMode: boolean) {
  withLitegraphNode((node) => {
    // Update the LiteGraph widget options
    const captureWidget = node.widgets?.find(
      (w) => w.name === CAPTURE_WIDGET_NAME
    )
    if (captureWidget) {
      captureWidget.options = {
        ...captureWidget.options,
        hidden: isOnRunMode
      }
    }

    // Update Vue state directly to trigger reactivity
    nodeManager.value?.updateVueWidgetOptions(
      String(node.id),
      CAPTURE_WIDGET_NAME,
      { hidden: isOnRunMode }
    )

    app.graph.setDirtyCanvas(true, true)
  })
}

// Computed to get capture_on_queue widget value from Vue state
const captureOnQueueValue = computed(() => {
  const vueNodeData = nodeManager.value?.vueNodeData.get(props.nodeId)
  const widget = vueNodeData?.widgets?.find(
    (w) => w.name === 'capture_on_queue'
  )
  return widget?.value === true
})

async function handleModeChange(isOnRunMode: boolean) {
  updateCaptureButtonVisibility(isOnRunMode)

  // When switching to "On Run" mode, clear captured image and restart camera
  if (isOnRunMode && capturedImageUrl.value) {
    capturedImageUrl.value = null
    lastUploadedPath.value = null
    // Remove retake button and restart camera preview
    removeWidgetsByName([RETAKE_WIDGET_NAME])
    await startCameraPreview()
  }

  // When switching to "Manually" mode, ensure capture button exists and is visible
  if (!isOnRunMode) {
    withLitegraphNode((node) => {
      const hasRetakeButton = node.widgets?.some(
        (w) => w.name === RETAKE_WIDGET_NAME
      )
      const hasCaptureButton = node.widgets?.some(
        (w) => w.name === CAPTURE_WIDGET_NAME
      )

      // If there's no retake button and no capture button, add the capture button
      if (!hasRetakeButton && !hasCaptureButton) {
        updateNodeWidgets(node, (widgets) => {
          const captureWidget = createActionWidget({
            name: CAPTURE_WIDGET_NAME,
            label: t('g.capturePhoto', 'Capture Photo'),
            iconClass: 'icon-[lucide--camera]',
            onClick: () => captureImage(node)
          })
          return [...widgets, captureWidget]
        })
        nodeManager.value?.refreshVueWidgets(String(node.id))
      }
    })
  }
}

function setupCaptureOnQueueWatcher() {
  // Set initial visibility
  updateCaptureButtonVisibility(captureOnQueueValue.value)

  // Watch for changes using Vue reactivity
  watch(
    captureOnQueueValue,
    (isOnRunMode) => {
      void handleModeChange(isOnRunMode)
    },
    { immediate: false }
  )
}

function removeWidgetsByName(names: string[]) {
  withLitegraphNode((node) => {
    if (!node.widgets?.length) return
    updateNodeWidgets(node, (widgets) =>
      widgets.filter((widget) => !names.includes(widget.name))
    )
    // Refresh Vue state to pick up widget removal
    nodeManager.value?.refreshVueWidgets(String(node.id))
  })
}

function storeOriginalWidgets() {
  withLitegraphNode((node) => {
    if (!node.widgets) return
    originalWidgets.value = node.widgets.map((widget) => toRaw(widget))
  })
}

function hideWidgets() {
  withLitegraphNode((node) => {
    if (!node.widgets?.length) return

    // Set default values AND apply visibility in one pass
    // Mutate widgets in place to preserve object identity for serializeValue closure
    updateNodeWidgets(
      node,
      (widgets) =>
        widgets.map((widget) => {
          applyWidgetVisibility(widget, true)

          // Set default values for width and height if not already set
          const needsDefault =
            widget.value === undefined ||
            widget.value === null ||
            widget.value === 0 ||
            widget.value === ''

          if (widget.name === 'width' && needsDefault) {
            widget.value = DEFAULT_VIDEO_WIDTH
          }
          if (widget.name === 'height' && needsDefault) {
            widget.value = DEFAULT_VIDEO_HEIGHT
          }

          return widget
        }),
      { dirtyCanvas: false }
    )

    // Refresh Vue state to pick up the hidden widgets
    nodeManager.value?.refreshVueWidgets(String(node.id))
  })
}

function restoreWidgets() {
  if (originalWidgets.value.length === 0) return
  withLitegraphNode((node) => setNodeWidgets(node, originalWidgets.value))
}

function setupSerializeValue() {
  withLitegraphNode((node) => {
    const imageWidget = node.widgets?.find((w) => toRaw(w).name === 'image')
    if (!imageWidget) return

    imageWidget.serializeValue = async () => {
      const captureOnQueueWidget = node.widgets?.find(
        (w) => w.name === 'capture_on_queue'
      )

      // Strictly check for boolean true (On Run mode)
      const shouldCaptureOnQueue = captureOnQueueWidget?.value === true

      if (shouldCaptureOnQueue) {
        // Auto-capture when queued - capture and upload immediately
        const dataUrl = capturePhoto(node)
        if (!dataUrl) {
          const err = t('g.failedToCaptureImage', 'Failed to capture image')
          useToastStore().addAlert(err)
          throw new Error(err)
        }
        const path = await uploadImage(dataUrl, node)
        return path
      } else {
        // Manual mode: validate image was captured
        if (!lastUploadedPath.value || !node.imgs?.length) {
          const err = t('g.noWebcamImageCaptured', 'No webcam image captured')
          useToastStore().addAlert(err)
          throw new Error(err)
        }
        return lastUploadedPath.value
      }
    }
  })
}

function showWidgets() {
  withLitegraphNode((node) => {
    // Get current capture_on_queue value to determine initial button visibility
    const captureOnQueueWidget = node.widgets?.find(
      (w) => w.name === 'capture_on_queue'
    )
    const isOnRunMode = captureOnQueueWidget?.value === true

    updateNodeWidgets(node, (widgets) => {
      const sanitizedWidgets = widgets
        .map((widget) => applyWidgetVisibility(widget, false))
        .filter(
          (widget) =>
            widget.name !== RETAKE_WIDGET_NAME &&
            widget.name !== CAPTURE_WIDGET_NAME
        )

      const captureWidget = createActionWidget({
        name: CAPTURE_WIDGET_NAME,
        label: t('g.capturePhoto', 'Capture Photo'),
        iconClass: 'icon-[lucide--camera]',
        onClick: () => captureImage(node)
      })

      // Hide capture button if in "On Run" mode
      if (isOnRunMode) {
        captureWidget.options = {
          ...captureWidget.options,
          hidden: true
        }
      }

      return [...sanitizedWidgets, captureWidget]
    })

    // Refresh Vue state to pick up the new widgets
    nodeManager.value?.refreshVueWidgets(String(node.id))

    // Set up watcher to toggle capture button visibility when mode changes
    setupCaptureOnQueueWatcher()
  })
}

function capturePhoto(node: LGraphNode) {
  if (!node) return null

  // Use visible video element if available, otherwise use persistent video
  const videoElement =
    videoRef.value ?? (stream.value?.active ? persistentVideo.value : null)
  if (!videoElement || !canvas.value) return null

  const widthWidget = node.widgets?.find((w) => toRaw(w).name === 'width')
  const heightWidget = node.widgets?.find((w) => toRaw(w).name === 'height')

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
    const errorMessage = error instanceof Error ? error.message : String(error)
    useToastStore().addAlert(
      t('g.errorCapturingImage', { error: errorMessage })
    )
    return null
  }
}

async function captureImage(node: LGraphNode) {
  const dataUrl = capturePhoto(node)
  if (!dataUrl) return

  capturedImageUrl.value = dataUrl
  isShowingPreview.value = false

  await uploadImage(dataUrl, node)

  updateNodeWidgets(node, (widgets) => {
    const preserved = widgets.filter((widget) => widget.type !== 'button')

    const retakeWidget = createActionWidget({
      name: RETAKE_WIDGET_NAME,
      label: t('g.retakePhoto', 'Retake photo'),
      iconClass: 'icon-[lucide--rotate-cw]',
      onClick: () => handleRetake()
    })

    return [...preserved, retakeWidget]
  })

  // Refresh Vue state to pick up the new widgets
  nodeManager.value?.refreshVueWidgets(String(node.id))
}

async function handleRetake() {
  capturedImageUrl.value = null
  lastUploadedPath.value = null
  removeWidgetsByName([RETAKE_WIDGET_NAME])
  await restartCameraPreview()
}

async function startCameraPreview() {
  if (props.readonly) return

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

        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.removeEventListener('error', onError)
          pendingVideoCleanup.value = null
        }

        const onLoadedMetadata = () => {
          cleanup()
          resolve()
        }

        const onError = (error: Event) => {
          cleanup()
          reject(error)
        }

        video.addEventListener('loadedmetadata', onLoadedMetadata)
        video.addEventListener('error', onError)

        // Store cleanup function for onUnmounted
        pendingVideoCleanup.value = cleanup

        setTimeout(() => {
          cleanup()
          resolve()
        }, 1000)
      })

      await videoRef.value.play()
    }

    isCameraOn.value = true
    showWidgets()
    await nextTick()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

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

function stopCameraPreview() {
  isShowingPreview.value = false
  hideWidgets() // Hide the capture button when stopping preview
}

async function restartCameraPreview() {
  stopStreamTracks()
  isShowingPreview.value = false
  await startCameraPreview()
}

function stopStreamTracks() {
  if (!stream.value) return
  stream.value.getTracks().forEach((track) => track.stop())
  stream.value = null
  isCameraOn.value = false
}

onMounted(async () => {
  // Create instance-specific elements for capture
  canvas.value = document.createElement('canvas')
  persistentVideo.value = document.createElement('video')
  persistentVideo.value.autoplay = true
  persistentVideo.value.muted = true
  persistentVideo.value.playsInline = true

  // Order matters: first set defaults via hideWidgets, THEN store original widgets
  // This ensures restoreWidgets() will restore the correct default values
  hideWidgets()
  // Wait for Vue reactivity to process the widget changes
  await nextTick()
  storeOriginalWidgets()
  setupSerializeValue()
})

onUnmounted(() => {
  // Clean up any pending video event listeners
  pendingVideoCleanup.value?.()
  stopStreamTracks()
  restoreWidgets()

  // Clean up instance-specific elements
  if (persistentVideo.value) {
    persistentVideo.value.srcObject = null
    persistentVideo.value = null
  }
  canvas.value = null
})
</script>
