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
        :class="{ 'p-button-danger': isRecording }"
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
import { IWidget, LGraphNode } from '@comfyorg/litegraph'
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import { ref, watch } from 'vue'

import { t } from '@/i18n'

const vTooltip = Tooltip

const props = defineProps<{
  node: LGraphNode
  isRecording: boolean
  hasRecording: boolean
  recordingDuration: number
}>()

const emit = defineEmits<{
  (e: 'startRecording'): void
  (e: 'stopRecording'): void
  (e: 'exportRecording'): void
  (e: 'clearRecording'): void
}>()

const node = ref(props.node)
const isRecording = ref(props.isRecording)
const hasRecording = ref(props.hasRecording)
const recordingDuration = ref(props.recordingDuration)

watch(
  () => props.isRecording,
  (newValue) => {
    isRecording.value = newValue
  }
)

watch(
  () => props.hasRecording,
  (newValue) => {
    hasRecording.value = newValue
  }
)

watch(
  () => props.recordingDuration,
  (newValue) => {
    recordingDuration.value = newValue
  }
)

const resizeNodeMatchOutput = () => {
  console.log('resizeNodeMatchOutput')

  const outputWidth = node.value.widgets?.find(
    (w: IWidget) => w.name === 'width'
  )
  const outputHeight = node.value.widgets?.find(
    (w: IWidget) => w.name === 'height'
  )

  if (outputWidth && outputHeight && outputHeight.value && outputWidth.value) {
    const [oldWidth, oldHeight] = node.value.size

    const scene = node.value.widgets?.find((w: IWidget) => w.name === 'image')

    const sceneHeight = scene?.computedHeight

    if (sceneHeight) {
      const sceneWidth = oldWidth - 20

      const outputRatio = Number(outputHeight.value) / Number(outputWidth.value)
      const expectSceneHeight = sceneWidth * outputRatio

      node.value.setSize([
        oldWidth,
        oldHeight + (expectSceneHeight - sceneHeight)
      ])
    }
  }
}

const toggleRecording = () => {
  if (isRecording.value) {
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
