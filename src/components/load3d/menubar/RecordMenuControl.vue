<template>
  <button
    v-tooltip.top="tip(recordLabel)"
    :class="chipClass"
    type="button"
    :aria-label="compact ? recordLabel : undefined"
    @click="toggleRecording"
  >
    <span
      v-if="isRecording"
      class="size-2 animate-pulse rounded-full bg-red-500"
    />
    <i v-else class="icon-[lucide--video] size-4" />
    <span v-if="!compact">{{ recordLabel }}</span>
  </button>

  <template v-if="hasRecording && !isRecording">
    <button
      v-tooltip.top="tip(t('load3d.exportRecording'))"
      :class="iconBtnClass"
      type="button"
      :aria-label="t('load3d.exportRecording')"
      @click="emit('exportRecording')"
    >
      <i class="icon-[lucide--download] size-4" />
    </button>
    <button
      v-tooltip.top="tip(t('load3d.clearRecording'))"
      :class="iconBtnClass"
      type="button"
      :aria-label="t('load3d.clearRecording')"
      @click="emit('clearRecording')"
    >
      <i class="icon-[lucide--trash-2] size-4" />
    </button>
    <span
      v-if="recordingDuration && recordingDuration > 0"
      class="px-1 text-sm text-base-foreground"
    >
      {{ formatDuration(recordingDuration) }}
    </span>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  chipClass,
  iconBtnClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'

const { compact = false } = defineProps<{
  compact?: boolean
}>()

const isRecording = defineModel<boolean>('isRecording')
const hasRecording = defineModel<boolean>('hasRecording')
const recordingDuration = defineModel<number>('recordingDuration')

const emit = defineEmits<{
  (e: 'startRecording'): void
  (e: 'stopRecording'): void
  (e: 'exportRecording'): void
  (e: 'clearRecording'): void
}>()

const { t } = useI18n()

const recordLabel = computed(() =>
  isRecording.value
    ? t('load3d.menuBar.stopRecording')
    : t('load3d.menuBar.record')
)

function toggleRecording() {
  if (isRecording.value) emit('stopRecording')
  else emit('startRecording')
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}
</script>
