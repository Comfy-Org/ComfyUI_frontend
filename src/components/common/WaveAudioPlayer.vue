<template>
  <!-- Compact: [▶] [waveform] [time] -->
  <div
    v-if="variant === 'compact'"
    :class="
      cn('flex w-full gap-2', align === 'center' ? 'items-center' : 'items-end')
    "
    @pointerdown.stop
  >
    <Button
      variant="textonly"
      size="icon-sm"
      class="size-7 shrink-0 rounded-full bg-muted-foreground/15 hover:bg-muted-foreground/25"
      :aria-label="isPlaying ? $t('g.pause') : $t('g.play')"
      :loading="loading"
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
      :class="
        cn(
          'flex min-w-0 flex-1 cursor-pointer gap-px',
          align === 'center' ? 'items-center' : 'items-end'
        )
      "
      :style="{ height: height + 'px' }"
      @click="handleWaveformClick"
    >
      <div
        v-for="(bar, index) in bars"
        :key="index"
        :class="
          cn(
            'flex-1 rounded-full',
            loading
              ? 'bg-muted-foreground/20'
              : index <= playedBarIndex
                ? 'bg-base-foreground'
                : 'bg-muted-foreground/40'
          )
        "
        :style="{
          height: (bar.height / 100) * height + 'px',
          minHeight: '2px'
        }"
      />
    </div>

    <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
      {{ formattedCurrentTime }} / {{ formattedDuration }}
    </span>
  </div>

  <!-- Expanded: waveform / progress bar + times / transport -->
  <div v-else class="flex w-full flex-col gap-4" @pointerdown.stop>
    <div
      class="flex w-full items-center gap-0.5"
      :style="{ height: height + 'px' }"
    >
      <div
        v-for="(bar, index) in bars"
        :key="index"
        :class="
          cn(
            'flex-1 rounded-full',
            loading ? 'bg-muted-foreground/20' : 'bg-base-foreground'
          )
        "
        :style="{
          height: (bar.height / 100) * height + 'px',
          minHeight: '2px'
        }"
      />
    </div>

    <div class="flex flex-col gap-1">
      <div
        ref="progressRef"
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
          :disabled="loading"
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
          :disabled="loading"
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
          :disabled="loading"
          @click="toggleMute"
        >
          <i :class="cn(volumeIcon, 'size-4 text-base-foreground')" />
        </Button>
        <Slider
          :model-value="[volume * 100]"
          :min="0"
          :max="100"
          :step="1"
          class="flex-1"
          @update:model-value="(v) => (volume = (v?.[0] ?? 100) / 100)"
        />
      </div>
    </div>
  </div>

  <audio
    :ref="(el) => (audioRef = el as HTMLAudioElement)"
    :src="audioSrc"
    preload="metadata"
    class="hidden"
  />
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import { useWaveAudioPlayer } from '@/composables/useWaveAudioPlayer'
import { cn } from '@/utils/tailwindUtil'

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

const {
  audioRef,
  waveformRef,
  audioSrc,
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
  src: toRef(() => src),
  barCount
})

function handleProgressClick(event: MouseEvent) {
  if (!progressRef.value) return
  const rect = progressRef.value.getBoundingClientRect()
  seekToRatio((event.clientX - rect.left) / rect.width)
}
</script>
