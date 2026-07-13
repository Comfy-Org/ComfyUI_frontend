<template>
  <button
    v-if="isRecording"
    v-tooltip.top="tip(t('load3d.menuBar.stopRecording'))"
    :class="chipClass"
    type="button"
    :aria-label="t('load3d.menuBar.stopRecording')"
    @click="emit('stopRecording')"
  >
    <span class="size-2 animate-pulse rounded-full bg-red-500" />
    <span v-if="!compact">{{ t('load3d.menuBar.recording') }}</span>
  </button>

  <div
    v-else-if="hasRecording"
    class="flex shrink-0 items-center gap-0.5 rounded-lg bg-button-active-surface py-0.5 pr-0.5 pl-1 text-sm text-base-foreground"
  >
    <Popover v-model:open="menuOpen">
      <PopoverTrigger as-child>
        <button
          v-tooltip.top="tip(t('load3d.menuBar.videoRecordingTooltip'))"
          class="focus-visible:ring-ring flex items-center gap-1.5 rounded-md border-0 bg-transparent px-1 py-0.5 text-sm text-base-foreground transition-colors outline-none hover:bg-button-hover-surface focus-visible:ring-1"
          type="button"
          :aria-label="t('load3d.menuBar.videoRecordingTooltip')"
          data-testid="load3d-recording-duration"
        >
          <i class="icon-[lucide--film] size-4" />
          {{ formatDuration(recordingDuration ?? 0) }}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        :side-offset="8"
        :class="panelClass"
      >
        <button
          type="button"
          :class="cn(rowClass, 'gap-2')"
          @click="downloadRecording"
        >
          <i class="icon-[lucide--download] size-4" />
          {{ t('load3d.menuBar.downloadRecording') }}
        </button>
        <button
          type="button"
          :class="cn(rowClass, 'gap-2')"
          @click="startNewRecording"
        >
          <i class="icon-[lucide--video] size-4" />
          {{ t('load3d.menuBar.startNewRecording') }}
        </button>
        <button
          type="button"
          :class="cn(rowClass, 'gap-2')"
          @click="deleteRecording"
        >
          <i class="icon-[lucide--trash-2] size-4" />
          {{ t('load3d.menuBar.deleteRecording') }}
        </button>
      </PopoverContent>
    </Popover>
    <button
      v-tooltip.top="tip(t('load3d.menuBar.deleteRecording'))"
      class="focus-visible:ring-ring flex size-6 items-center justify-center rounded-md border-0 bg-transparent text-base-foreground transition-colors outline-none hover:bg-button-hover-surface focus-visible:ring-1"
      type="button"
      :aria-label="t('load3d.menuBar.deleteRecording')"
      @click="emit('clearRecording')"
    >
      <i class="icon-[lucide--x] size-3.5" />
    </button>
  </div>

  <button
    v-else
    v-tooltip.top="tip(t('load3d.menuBar.record'))"
    :class="chipClass"
    type="button"
    :aria-label="compact ? t('load3d.menuBar.record') : undefined"
    @click="emit('startRecording')"
  >
    <i class="icon-[lucide--video] size-4" />
    <span v-if="!compact">{{ t('load3d.menuBar.record') }}</span>
  </button>
</template>

<script setup lang="ts">
import { PopoverTrigger } from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  chipClass,
  panelClass,
  rowClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { cn } from '@comfyorg/tailwind-utils'

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

const menuOpen = ref(false)

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
