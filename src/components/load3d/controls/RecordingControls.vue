<template>
  <div class="relative bg-gray-700 bg-opacity-30 rounded-lg">
    <div class="flex flex-col gap-2">
      <Button
        class="p-button-rounded p-button-text"
        @click="resizeNodeMatchOutput"
      >
        <i
          v-tooltip.right="{
            value: t('load3d.resizeNodeMatchOutput'),
            showDelay: 300
          }"
          class="pi pi-window-maximize text-white text-lg"
        />
      </Button>
      <Button
        class="p-button-rounded p-button-text"
        :class="{
          'p-button-danger': isRecording,
          'recording-button-blink': isRecording
        }"
        @click="toggleRecording"
      >
        <i
          v-tooltip.right="{
            value: isRecording
              ? t('load3d.stopRecording')
              : t('load3d.startRecording'),
            showDelay: 300
          }"
          :class="[
            'pi',
            isRecording ? 'pi-circle-fill' : 'pi-video',
            'text-white text-lg'
          ]"
        />
      </Button>

      <Button
        v-if="hasRecording && !isRecording"
        class="p-button-rounded p-button-text"
        @click="exportRecording"
      >
        <i
          v-tooltip.right="{
            value: t('load3d.exportRecording'),
            showDelay: 300
          }"
          class="pi pi-download text-white text-lg"
        />
      </Button>

      <Button
        v-if="hasRecording && !isRecording"
        class="p-button-rounded p-button-text"
        @click="clearRecording"
      >
        <i
          v-tooltip.right="{
            value: t('load3d.clearRecording'),
            showDelay: 300
          }"
          class="pi pi-trash text-white text-lg"
        />
      </Button>

      <div
        v-if="recordingDuration > 0 && !isRecording"
        class="text-xs text-white text-center mt-1"
      >
        {{ formatDuration(recordingDuration) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LGraphNode } from '@comfyorg/litegraph'
import { Tooltip } from 'primevue'
import Button from 'primevue/button'

import { t } from '@/i18n'
import { useLoad3dService } from '@/services/load3dService'

const vTooltip = Tooltip

const { hasRecording, isRecording, node, recordingDuration } = defineProps<{
  hasRecording: boolean
  isRecording: boolean
  node: LGraphNode
  recordingDuration: number
}>()

const emit = defineEmits<{
  (e: 'startRecording'): void
  (e: 'stopRecording'): void
  (e: 'exportRecording'): void
  (e: 'clearRecording'): void
}>()

const resizeNodeMatchOutput = () => {
  const outputWidth = node.widgets?.find((w) => w.name === 'width')
  const outputHeight = node.widgets?.find((w) => w.name === 'height')

  if (outputWidth && outputHeight && outputHeight.value && outputWidth.value) {
    const [oldWidth, oldHeight] = node.size

    const scene = node.widgets?.find((w) => w.name === 'image')

    const sceneHeight = scene?.computedHeight

    if (sceneHeight) {
      const sceneWidth = oldWidth - 20

      const outputRatio = Number(outputHeight.value) / Number(outputWidth.value)
      const expectSceneHeight = sceneWidth * outputRatio

      node.setSize([oldWidth, oldHeight + (expectSceneHeight - sceneHeight)])

      node.graph?.setDirtyCanvas(true, true)

      const load3d = useLoad3dService().getLoad3d(node as LGraphNode)

      if (load3d) {
        load3d.refreshViewport()
      }
    }
  }
}

const toggleRecording = () => {
  if (isRecording) {
    emit('stopRecording')
  } else {
    emit('startRecording')
  }
}

const exportRecording = () => {
  emit('exportRecording')
}

const clearRecording = () => {
  emit('clearRecording')
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.recording-button-blink {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
