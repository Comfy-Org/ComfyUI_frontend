<template>
  <Button
    v-if="isRecording"
    variant="textonly"
    size="unset"
    :tooltip="t('load3d.menuBar.stopRecording')"
    :class="chipClass"
    type="button"
    :aria-label="t('load3d.menuBar.stopRecording')"
    @click="emit('stopRecording')"
  >
    <span class="size-2 animate-pulse rounded-full bg-destructive" />
    <span v-if="!compact">{{ t('load3d.menuBar.recording') }}</span>
  </Button>

  <div
    v-else-if="hasRecording"
    class="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted py-0.5 pr-0.5 pl-1 text-sm text-foreground"
  >
    <PopoverRoot v-model:open="menuOpen">
      <PopoverTrigger as-child>
        <Button
          variant="textonly"
          size="unset"
          :tooltip="t('load3d.menuBar.videoRecordingTooltip')"
          class="gap-1.5 px-1 py-0.5"
          type="button"
          :aria-label="t('load3d.menuBar.videoRecordingTooltip')"
          data-testid="load3d-recording-duration"
        >
          <i class="icon-[lucide--film]" />
          {{ formatDuration(recordingDuration ?? 0) }}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" :side-offset="8" :class="menuPanelClass">
        <button
          type="button"
          :class="menuButtonClass"
          @click="downloadRecording"
        >
          <i class="icon-[lucide--download]" />
          {{ t('load3d.menuBar.downloadRecording') }}
        </button>
        <button
          type="button"
          :class="menuButtonClass"
          @click="startNewRecording"
        >
          <i class="icon-[lucide--video]" />
          {{ t('load3d.menuBar.startNewRecording') }}
        </button>
        <button type="button" :class="menuButtonClass" @click="deleteRecording">
          <i class="icon-[lucide--trash-2]" />
          {{ t('load3d.menuBar.deleteRecording') }}
        </button>
      </PopoverContent>
    </PopoverRoot>
    <Button
      variant="textonly"
      size="unset"
      :tooltip="t('load3d.menuBar.deleteRecording')"
      class="size-6"
      type="button"
      :aria-label="t('load3d.menuBar.deleteRecording')"
      @click="emit('clearRecording')"
    >
      <i class="icon-[lucide--x] size-3.5" />
    </Button>
  </div>

  <Button
    v-else
    variant="textonly"
    size="unset"
    :tooltip="t('load3d.menuBar.record')"
    :class="chipClass"
    type="button"
    :aria-label="compact ? t('load3d.menuBar.record') : undefined"
    @click="emit('startRecording')"
  >
    <i class="icon-[lucide--video]" />
    <span v-if="!compact">{{ t('load3d.menuBar.record') }}</span>
  </Button>
</template>

<script setup lang="ts">
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import {
  chipClass,
  menuPanelClass
} from '@/extensions/core/load3d/components/menubar/menuBarStyles'
import { usePopoverExclusivity } from '@/extensions/core/load3d/components/menubar/usePopoverExclusivity'
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { menuButtonClass } from '@comfyorg/design-system/lib/menu/menuStyles'

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

const menuOpen = usePopoverExclusivity()('recording-menu')

function downloadRecording() {
  menuOpen.value = false
  emit('exportRecording')
}

function startNewRecording() {
  menuOpen.value = false
  emit('startRecording')
}

function deleteRecording() {
  menuOpen.value = false
  emit('clearRecording')
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}
</script>
