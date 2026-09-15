<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Slider from '@/components/ui/slider/Slider.vue'
import { useWaveAudioPlayer } from '@/composables/useWaveAudioPlayer'
import { cn } from '@comfyorg/tailwind-utils'

import { downloadReplyAsset } from '../../../utils/downloadReplyAsset'
import type { ReplyAsset } from '../../../utils/replyAssets'

const { asset, title } = defineProps<{ asset: ReplyAsset; title: string }>()

const { t } = useI18n()

const {
  audioRef,
  isPlaying,
  progressRatio,
  formattedCurrentTime,
  formattedDuration,
  togglePlayPause,
  muted,
  volumeIcon,
  toggleMute,
  seekToRatio
} = useWaveAudioPlayer({ src: toRef(() => asset.url), waveform: false })

function onScrub(value: number[] | undefined): void {
  if (value?.length) seekToRatio(value[0] / 100)
}

function download(): void {
  void downloadReplyAsset(asset).catch(() => {})
}
</script>

<template>
  <div
    class="group/audio flex w-full items-center gap-2.5 rounded-lg border border-component-node-border px-3 py-2.5"
  >
    <audio
      :ref="(el) => (audioRef = el as HTMLAudioElement)"
      data-testid="reply-audio-element"
      class="hidden"
      :src="asset.url"
      preload="metadata"
    />
    <button
      type="button"
      :aria-label="isPlaying ? t('g.pause') : t('g.play')"
      class="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-component-node-border bg-secondary-background text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
      @click="togglePlayPause"
    >
      <span
        :class="
          cn(
            'size-4',
            isPlaying ? 'icon-[lucide--pause]' : 'icon-[lucide--play]'
          )
        "
      />
    </button>
    <div class="flex min-w-0 flex-1 flex-col">
      <span class="truncate text-sm/4 font-medium text-base-foreground">{{
        title
      }}</span>
      <div class="flex h-6 items-center gap-4">
        <span
          class="text-xs whitespace-nowrap text-muted-foreground tabular-nums"
        >
          {{ formattedCurrentTime }} / {{ formattedDuration }}
        </span>
        <Slider
          class="min-w-0 flex-1"
          thumb-class="opacity-0 transition-opacity group-hover/audio:opacity-100 focus-visible:opacity-100"
          :model-value="[progressRatio]"
          :max="100"
          :step="0.1"
          @update:model-value="onScrub"
        />
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            :aria-label="muted ? t('g.unmute') : t('g.mute')"
            class="flex size-6 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:outline-none"
            @click="toggleMute"
          >
            <span :class="cn('size-4', volumeIcon)" />
          </button>
          <button
            type="button"
            :aria-label="t('g.download')"
            class="flex size-6 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:outline-none"
            @click="download"
          >
            <span class="icon-[lucide--download] size-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
