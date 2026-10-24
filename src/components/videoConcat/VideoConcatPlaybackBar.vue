<template>
  <div
    data-testid="video-concat-controls"
    class="flex h-8 items-center gap-2 px-1"
  >
    <button
      type="button"
      data-testid="video-concat-playback-toggle"
      class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-foreground hover:bg-muted"
      :aria-label="isPlaying ? t('videoEdit.pause') : t('videoEdit.play')"
      @click="isPlaying = !isPlaying"
    >
      <i
        :class="
          cn(
            isPlaying ? 'icon-[lucide--pause]' : 'icon-[lucide--play]',
            'size-4'
          )
        "
      />
    </button>
    <span
      data-testid="video-concat-timecode"
      class="shrink-0 text-muted-foreground tabular-nums"
    >
      {{
        t('videoEdit.timecode', {
          current: formatTimecode(currentTime),
          total: formatTimecode(totalDuration)
        })
      }}
    </span>
    <Slider
      class="min-w-0 flex-1"
      :model-value="[currentTime]"
      :min="0"
      :max="Math.max(totalDuration, 0.01)"
      :step="0.01"
      :disabled="totalDuration <= 0"
      :aria-label="t('videoEdit.seekVideo')"
      @update:model-value="handleSliderSeek"
    />
    <button
      type="button"
      data-testid="video-concat-mute"
      class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-muted"
      :aria-label="isMuted ? t('videoEdit.unmute') : t('videoEdit.mute')"
      @click="isMuted = !isMuted"
    >
      <i
        :class="
          cn(
            isMuted ? 'icon-[lucide--volume-x]' : 'icon-[lucide--volume-2]',
            'size-4'
          )
        "
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Slider from '@/components/ui/slider/Slider.vue'
import { useVideoEditFormats } from '@/composables/video/useVideoEditFormats'
import { cn } from '@comfyorg/tailwind-utils'

const { currentTime, totalDuration } = defineProps<{
  currentTime: number
  totalDuration: number
}>()

const emit = defineEmits<{
  seek: [time: number]
}>()

const isPlaying = defineModel<boolean>('playing', { required: true })
const isMuted = defineModel<boolean>('muted', { required: true })

const { t } = useI18n()
const { formatTimecode } = useVideoEditFormats()

function handleSliderSeek(value: number[] | undefined) {
  const time = value?.[0]
  if (typeof time === 'number') emit('seek', time)
}
</script>
