<template>
  <!-- Compact: [▶] [waveform] [time] -->
  <div
    v-if="variant === 'compact'"
    :class="
      cn('flex w-full gap-2', align === 'center' ? 'items-center' : 'items-end')
    "
    @pointerdown.stop
    @click.stop
  >
    <Button
      variant="textonly"
      size="icon-sm"
      class="size-7 shrink-0 rounded-full bg-muted-foreground/15 hover:bg-muted-foreground/25"
      :aria-label="isPlaying ? $t('g.pause') : $t('g.play')"
      :loading="loading"
      :disabled="failed"
      @click.stop="togglePlayPause"
    >
      <i
        v-if="!isPlaying"
        class="ml-0.5 icon-[lucide--play] size-3 text-base-foreground"
      />
      <i v-else class="icon-[lucide--pause] size-3 text-base-foreground" />
    </Button>

    <div
      :ref="(el) => (waveformRef = el as HTMLElement)"
      data-testid="wave-audio-waveform"
      :class="
        cn(
          'flex min-w-0 flex-1 cursor-pointer gap-px',
          align === 'center' ? 'items-center' : 'items-end'
        )
      "
      :style="{ height: height + 'px' }"
      @click="onWaveformClick"
    >
      <div
        v-for="(bar, index) in bars"
        :key="index"
        :class="
          cn(
            'min-h-0.5 flex-1 rounded-full',
            loading
              ? 'bg-muted-foreground/20'
              : index <= playedBarIndex
                ? 'bg-base-foreground'
                : 'bg-muted-foreground/40'
          )
        "
        :style="{ height: (bar.height / 100) * height + 'px' }"
      />
    </div>

    <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
      {{ formattedCurrentTime }} / {{ formattedDuration }}
    </span>
  </div>

  <!-- Expanded: waveform / progress bar + times / transport -->
  <div v-else class="flex w-full flex-col gap-4" @pointerdown.stop @click.stop>
    <div
      class="flex w-full items-center gap-0.5"
      :style="{ height: height + 'px' }"
    >
      <div
        v-for="(bar, index) in bars"
        :key="index"
        :class="
          cn(
            'min-h-0.5 flex-1 rounded-full',
            loading ? 'bg-muted-foreground/20' : 'bg-base-foreground'
          )
        "
        :style="{ height: (bar.height / 100) * height + 'px' }"
      />
    </div>

    <div class="flex flex-col gap-1">
      <div
        ref="progressRef"
        data-testid="wave-audio-progress"
        class="relative h-1 w-full cursor-pointer rounded-full bg-muted-foreground/20"
        @click="handleProgressClick"
      >
        <div
          class="absolute top-0 left-0 h-full rounded-full bg-base-foreground"
          :style="{ width: progressRatio + '%' }"
        />
      </div>
      <div
        class="flex justify-between text-xs text-muted-foreground tabular-nums"
      >
        <span>{{ formattedCurrentTime }}</span>
        <span>{{ formattedDuration }}</span>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <div class="w-20" />

      <div class="flex flex-1 items-center justify-center gap-2">
        <Button
          variant="textonly"
          size="icon-sm"
          class="size-8 rounded-full"
          :aria-label="$t('g.skipToStart')"
          :disabled="loading || failed"
          @click="seekToStart"
        >
          <i class="icon-[lucide--skip-back] size-4 text-base-foreground" />
        </Button>
        <Button
          variant="textonly"
          size="icon-sm"
          class="size-10 rounded-full bg-muted-foreground/15 hover:bg-muted-foreground/25"
          :aria-label="isPlaying ? $t('g.pause') : $t('g.play')"
          :loading="loading"
          :disabled="failed"
          @click="togglePlayPause"
        >
          <i
            v-if="!isPlaying"
            class="ml-0.5 icon-[lucide--play] size-5 text-base-foreground"
          />
          <i v-else class="icon-[lucide--pause] size-5 text-base-foreground" />
        </Button>
        <Button
          variant="textonly"
          size="icon-sm"
          class="size-8 rounded-full"
          :aria-label="$t('g.skipToEnd')"
          :disabled="loading || failed"
          @click="seekToEnd"
        >
          <i class="icon-[lucide--skip-forward] size-4 text-base-foreground" />
        </Button>
      </div>

      <div class="flex w-20 items-center gap-1">
        <Button
          variant="textonly"
          size="icon-sm"
          class="size-8 shrink-0 rounded-full"
          :aria-label="$t('g.volume')"
          :disabled="loading || failed"
          @click="toggleMute"
        >
          <i :class="cn(volumeIcon, 'size-4 text-base-foreground')" />
        </Button>
        <Slider
          :model-value="[volume * 100]"
          :min="0"
          :max="100"
          :step="1"
          :disabled="failed"
          class="flex-1"
          @update:model-value="(v) => (volume = (v?.[0] ?? 100) / 100)"
        />
      </div>
    </div>
  </div>

  <audio
    :ref="(el) => (audioRef = el as HTMLAudioElement)"
    data-testid="wave-audio-media"
    :src="mediaSrc"
    preload="metadata"
    class="hidden"
    @error="onError"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import { useRetryableMediaSrc } from '@/composables/media/useRetryableMediaSrc'
import { useWaveAudioPlayer } from '@/composables/useWaveAudioPlayer'
import { cn } from '@comfyorg/tailwind-utils'

const {
  src,
  barCount = 40,
  height = 32,
  align = 'center',
  variant = 'compact'
} = defineProps<{
  src: string
  barCount?: number
  height?: number
  align?: 'center' | 'bottom'
  variant?: 'compact' | 'expanded'
}>()

const progressRef = ref<HTMLElement>()

const { src: mediaSrc, status, onError } = useRetryableMediaSrc(() => src)
const failed = computed(() => status.value === 'failed')

const {
  audioRef,
  waveformRef,
  bars,
  loading,
  isPlaying,
  playedBarIndex,
  progressRatio,
  formattedCurrentTime,
  formattedDuration,
  togglePlayPause,
  seekToStart,
  seekToEnd,
  volume,
  volumeIcon,
  toggleMute,
  seekToRatio,
  handleWaveformClick
} = useWaveAudioPlayer({
  src: mediaSrc,
  barCount
})

function onWaveformClick(event: MouseEvent) {
  if (failed.value) return
  handleWaveformClick(event)
}

function handleProgressClick(event: MouseEvent) {
  if (failed.value) return
  if (!progressRef.value) return
  const rect = progressRef.value.getBoundingClientRect()
  seekToRatio((event.clientX - rect.left) / rect.width)
}
</script>
