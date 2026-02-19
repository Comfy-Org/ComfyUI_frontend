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
        @click="handleStopPreview"
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
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import {
  DEFAULT_VIDEO_HEIGHT,
  DEFAULT_VIDEO_WIDTH,
  useWebcamCapture
} from '../composables/useWebcamCapture'

const { nodeManager } = useVueNodeLifecycle()

/* eslint-disable vue/no-unused-properties */
// widget prop is part of the standard widget component interface
const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  readonly?: boolean
  nodeId: string
}>()
/* eslint-enable vue/no-unused-properties */

// Refs for video elements
const videoRef = ref<HTMLVideoElement>()
const videoContainerRef = ref<HTMLElement>()
const isHovered = useElementHover(videoContainerRef)
const originalWidgets = ref<IBaseWidget[]>([])

// Use the webcam capture composable
const {
  isShowingPreview,
  capturedImageUrl,
  lastUploadedPath,
  startCameraPreview,
  stopCameraPreview,
  restartCameraPreview,
  capturePhoto,
  uploadImage,
  clearCapturedImage,
  initializeElements,
  cleanup
} = useWebcamCapture({
  videoRef,
  readonly: props.readonly,
  onCameraStart: () => showWidgets()
})

// Constants for widget names
const TOGGLED_WIDGET_NAMES = new Set(['height', 'width', 'capture_on_queue'])
const CAPTURE_WIDGET_NAME = 'capture'
const RETAKE_WIDGET_NAME = 'retake'

// Widget update types
type WidgetTransformer = (widgets: IBaseWidget[]) => IBaseWidget[]

interface WidgetUpdateOptions {
  dirtyCanvas?: boolean
}

// LiteGraph node access
const litegraphNode = computed(() => {
  if (!props.nodeId || !app.rootGraph) return null
  return app.rootGraph.getNodeById(props.nodeId) as LGraphNode | null
})

function withLitegraphNode<T>(handler: (node: LGraphNode) => T) {
  const node = litegraphNode.value
  if (!node) return null
  return handler(node)
}

// Widget management functions
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
    widget.type = 'selectToggle'
    widget.label = 'Capture Image'
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

function removeWidgetsByName(names: string[]) {
  withLitegraphNode((node) => {
    if (!node.widgets?.length) return
    updateNodeWidgets(node, (widgets) =>
      widgets.filter((widget) => !names.includes(widget.name))
    )
  })
}

// Capture mode handling
function updateCaptureButtonVisibility(isOnRunMode: boolean) {
  withLitegraphNode((node) => {
    const captureWidget = node.widgets?.find(
      (w) => w.name === CAPTURE_WIDGET_NAME
    )
    if (captureWidget) {
      captureWidget.options = {
        ...captureWidget.options,
        hidden: isOnRunMode
      }
    }

    app.graph.setDirtyCanvas(true, true)
  })
}

const captureOnQueueValue = computed(() => {
  const vueNodeData = nodeManager.value?.vueNodeData.get(props.nodeId)
  const widget = vueNodeData?.widgets?.find(
    (w) => w.name === 'capture_on_queue'
  )
  return widget?.value === true
})

async function handleModeChange(isOnRunMode: boolean) {
  updateCaptureButtonVisibility(isOnRunMode)

  if (isOnRunMode && capturedImageUrl.value) {
    clearCapturedImage()
    removeWidgetsByName([RETAKE_WIDGET_NAME])
    await startCameraPreview()
  }

  if (!isOnRunMode) {
    withLitegraphNode((node) => {
      const hasRetakeButton = node.widgets?.some(
        (w) => w.name === RETAKE_WIDGET_NAME
      )
      const hasCaptureButton = node.widgets?.some(
        (w) => w.name === CAPTURE_WIDGET_NAME
      )

      if (!hasRetakeButton && !hasCaptureButton) {
        updateNodeWidgets(node, (widgets) => {
          const captureWidget = createActionWidget({
            name: CAPTURE_WIDGET_NAME,
            label: t('g.capturePhoto', 'Capture Photo'),
            iconClass: 'icon-[lucide--camera]',
            onClick: () => handleCaptureImage(node)
          })
          return [...widgets, captureWidget]
        })
      }
    })
  }
}

function setupCaptureOnQueueWatcher() {
  updateCaptureButtonVisibility(captureOnQueueValue.value)

  watch(
    captureOnQueueValue,
    (isOnRunMode) => {
      void handleModeChange(isOnRunMode)
    },
    { immediate: false }
  )
}

// Widget lifecycle
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
          applyWidgetVisibility(widget, true)

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

      const shouldCaptureOnQueue = captureOnQueueWidget?.value === true

      if (shouldCaptureOnQueue) {
        const dataUrl = capturePhoto(node)
        if (!dataUrl) {
          const err = t('g.failedToCaptureImage', 'Failed to capture image')
          useToastStore().addAlert(err)
          throw new Error(err)
        }
        const path = await uploadImage(dataUrl, node)
        return path
      } else {
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
        onClick: () => handleCaptureImage(node)
      })

      if (isOnRunMode) {
        captureWidget.options = {
          ...captureWidget.options,
          hidden: true
        }
      }

      return [...sanitizedWidgets, captureWidget]
    })

    setupCaptureOnQueueWatcher()
  })
}

// Capture and retake handlers
async function handleCaptureImage(node: LGraphNode) {
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
  clearCapturedImage()
  removeWidgetsByName([RETAKE_WIDGET_NAME])
  await restartCameraPreview()
}

function handleStopPreview() {
  stopCameraPreview()
  hideWidgets()
}

// Lifecycle
onMounted(async () => {
  initializeElements()
  hideWidgets()
  await nextTick()
  storeOriginalWidgets()
  setupSerializeValue()
})

onUnmounted(() => {
  cleanup()
  restoreWidgets()
})
</script>
