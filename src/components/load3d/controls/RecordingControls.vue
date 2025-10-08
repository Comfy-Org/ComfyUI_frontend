<template>
  <div class="relative bg-gray-700/30 rounded-lg">
    <div class="flex flex-col gap-2">
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
        @click="handleExportRecording"
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
        @click="handleClearRecording"
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
        v-if="recordingDuration && recordingDuration > 0 && !isRecording"
        class="text-xs text-white text-center mt-1"
      >
        {{ formatDuration(recordingDuration) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'

import { t } from '@/i18n'

const vTooltip = Tooltip

const hasRecording = defineModel<boolean>('hasRecording')
const isRecording = defineModel<boolean>('isRecording')
const recordingDuration = defineModel<number>('recordingDuration')

const emit = defineEmits<{
  (e: 'startRecording'): void
  (e: 'stopRecording'): void
  (e: 'exportRecording'): void
  (e: 'clearRecording'): void
}>()

const toggleRecording = () => {
  if (isRecording.value) {
    emit('stopRecording')
  } else {
    emit('startRecording')
  }
}

const handleExportRecording = () => {
  emit('exportRecording')
}

const handleClearRecording = () => {
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
