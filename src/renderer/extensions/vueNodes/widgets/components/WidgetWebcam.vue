<template>
  <div class="relative">
    <div v-if="!isShowingPreview" class="mb-4">
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
          <i class="icon-[lucide--square] size-6 text-white" />
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

const litegraphNode = computed(() => {
  if (!props.nodeId || !app.rootGraph) return null
  return app.rootGraph.getNodeById(props.nodeId) as LGraphNode | null
})

function storeOriginalWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets) return

  originalWidgets.value = node.widgets.map((w) => toRaw(w))
}

function hideWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets) return

  const newWidgets = node.widgets.map((widget) => {
    const rawWidget = toRaw(widget)
    const shouldHide = ['height', 'width', 'capture_on_queue'].includes(
      rawWidget.name
    )

    if (shouldHide) {
      if (rawWidget.name === 'capture_on_queue') {
        return markRaw({
          ...rawWidget,
          type: 'selectToggle',
          label: 'Capture Image',
          value: rawWidget.value ?? false,
          options: {
            ...rawWidget.options,
            hidden: true,
            values: [
              { label: 'On Run', value: true },
              { label: 'Manually', value: false }
            ]
          }
        })
      }

      return markRaw({
        ...rawWidget,
        options: {
          ...rawWidget.options,
          hidden: true
        }
      })
    }
    return rawWidget
  })

  node.widgets = newWidgets
}

function restoreWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets || originalWidgets.value.length === 0) return

  node.widgets = originalWidgets.value.map((w) => toRaw(w))
}

function showWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets) return

  const newWidgets = node.widgets.map((widget) => {
    const rawWidget = toRaw(widget)
    const shouldShow = ['height', 'width', 'capture_on_queue'].includes(
      rawWidget.name
    )

    if (shouldShow) {
      if (rawWidget.name === 'capture_on_queue') {
        return markRaw({
          ...rawWidget,
          type: 'selectToggle',
          label: 'Capture Image',
          value: rawWidget.value ?? false,
          options: {
            ...rawWidget.options,
            hidden: false,
            values: [
              { label: 'On Run', value: true },
              { label: 'Manually', value: false }
            ]
          }
        })
      }

      return markRaw({
        ...rawWidget,
        options: {
          ...rawWidget.options,
          hidden: false
        }
      })
    }
    return rawWidget
  })

  node.widgets = newWidgets

  if (node.graph) {
    node.graph._version++
  }

  app.graph.setDirtyCanvas(true, true)
}

async function startCameraPreview() {
  if (props.readonly) return

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
    app.graph.setDirtyCanvas(true, true)
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

onMounted(() => {
  storeOriginalWidgets()
  hideWidgets()
})

onUnmounted(() => {
  if (stream.value) {
    stream.value.getTracks().forEach((track) => track.stop())
    stream.value = null
  }

  restoreWidgets()
})
</script>
