<template>
  <div class="relative">
    <div v-if="capturedImageUrl" class="mb-4">
      <img
        :src="capturedImageUrl"
        class="w-full rounded-lg bg-node-component-surface"
        alt="Captured image"
      />
    </div>

    <div v-else-if="!isShowingPreview" class="mb-4">
      <Button
        class="text-text-secondary w-full border-0 bg-component-node-widget-background hover:bg-secondary-background-hover"
        :disabled="readonly"
        @click="startCameraPreview"
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
        <div class="text-text-secondary mb-4 text-sm">
          {{ t('g.clickToStopLivePreview', 'Click to stop live preview') }}
        </div>

        <div
          class="flex size-12 items-center justify-center rounded-full bg-danger"
        >
          <i class="icon-[lucide--square] size-6 bg-red-400" />
        </div>
      </div>
    </div>

    <LODFallback />
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
  toRaw
} from 'vue'

import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useToastStore } from '@/platform/updates/common/toastStore'
import LODFallback from '@/renderer/extensions/vueNodes/components/LODFallback.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  readonly?: boolean
  nodeId: string
}>()

const isCameraOn = ref(false)
const isShowingPreview = ref(false)
const originalWidgets = ref<IBaseWidget[]>([])
const videoRef = ref<HTMLVideoElement>()
const videoContainerRef = ref<HTMLElement>()
const stream = ref<MediaStream | null>(null)
const isHovered = useElementHover(videoContainerRef)
const canvas = document.createElement('canvas')
const capturedImageUrl = ref<string | null>(null)

const TOGGLED_WIDGET_NAMES = new Set(['height', 'width', 'capture_on_queue'])
const CAPTURE_WIDGET_NAME = 'capture'
const RETAKE_WIDGET_NAME = 'retake'

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
    return {
      ...widget,
      type: 'selectToggle',
      label: 'Capture Image',
      value: widget.value ?? false,
      options: {
        ...widget.options,
        hidden,
        values: [
          { label: 'On Run', value: true },
          { label: 'Manually', value: false }
        ]
      }
    }
  }

  return {
    ...widget,
    options: {
      ...widget.options,
      hidden
    }
  }
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
      serialize: false
    },
    callback: onClick
  }
}

function removeWidgetsByName(names: string[]) {
  withLitegraphNode((node) => {
    if (!node.widgets?.length) return
    updateNodeWidgets(node, (widgets) =>
      widgets.filter((widget) => !names.includes(widget.name))
    )
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
    updateNodeWidgets(
      node,
      (widgets) =>
        widgets.map((widget) => {
          const visibleWidget = applyWidgetVisibility(widget, true)

          // Set default values for width and height if not already set
          // This replicates behavior from webcamCapture.ts line 148-157
          if (widget.name === 'width' && !widget.value) {
            return { ...visibleWidget, value: 640 }
          }
          if (widget.name === 'height' && !widget.value) {
            return { ...visibleWidget, value: 480 }
          }

          return visibleWidget
        }),
      { dirtyCanvas: false }
    )
  })
}

function restoreWidgets() {
  if (originalWidgets.value.length === 0) return
  withLitegraphNode((node) => setNodeWidgets(node, originalWidgets.value))
}

function showWidgets() {
  withLitegraphNode((node) => {
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
        label: t('g.capture', 'Capture'),
        iconClass: 'icon-[lucide--camera]',
        onClick: () => captureImage(node)
      })

      return [...sanitizedWidgets, captureWidget]
    })
  })
}

function capturePhoto(node: LGraphNode) {
  if (!node || !videoRef.value) return null

  const widthWidget = node.widgets?.find((w) => toRaw(w).name === 'width')
  const heightWidget = node.widgets?.find((w) => toRaw(w).name === 'height')

  const width = (widthWidget?.value as number) || 640
  const height = (heightWidget?.value as number) || 480

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(videoRef.value, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

async function uploadImage(dataUrl: string, node: LGraphNode) {
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
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

    const img = new Image()
    img.onload = () => {
      node.imgs = [img]
      app.graph.setDirtyCanvas(true)
    }
    img.src = dataUrl
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    useToastStore().addAlert(
      t('g.errorCapturingImage', { error: errorMessage })
    )
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
}

async function handleRetake() {
  capturedImageUrl.value = null
  removeWidgetsByName([RETAKE_WIDGET_NAME])
  await restartCameraPreview()
}

async function startCameraPreview() {
  if (props.readonly) return

  capturedImageUrl.value = null

  try {
    if (isCameraOn.value && stream.value && stream.value.active) {
      isShowingPreview.value = true
      await nextTick()

      if (videoRef.value && stream.value) {
        videoRef.value.srcObject = stream.value
        await videoRef.value.play()
      }

      return
    }

    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    })

    stream.value = cameraStream
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

        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          resolve()
        }

        const onError = (error: Event) => {
          video.removeEventListener('error', onError)
          reject(error)
        }

        video.addEventListener('loadedmetadata', onLoadedMetadata)
        video.addEventListener('error', onError)

        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.removeEventListener('error', onError)
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

    isShowingPreview.value = false
    isCameraOn.value = false
  }
}

function stopCameraPreview() {
  isShowingPreview.value = false
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

onMounted(() => {
  storeOriginalWidgets()
  hideWidgets()
})

onUnmounted(() => {
  stopStreamTracks()
  restoreWidgets()
})
</script>
