<script setup lang="ts">
import { Pause, Play, X } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { formatSize } from '@comfyorg/shared-frontend-utils/formatUtil'

import { clock, useAudioPlayback } from '../../composables/useAudioPlayback'
import { useSourceUrl } from '../../composables/useSourceUrl'
import type { FileValue } from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ImageSourcePreview from './ImageSourcePreview.vue'
import VideoSourcePreview from './VideoSourcePreview.vue'

const {
  file,
  attention = false,
  disabled = false,
  locale = 'en'
} = defineProps<{
  file: FileValue
  /** This upload is the one a warning is about. Not an error: nothing blocks. */
  attention?: boolean
  disabled?: boolean
  locale?: Locale
}>()
defineEmits<{ replace: []; remove: [] }>()

const fileType = computed(
  () =>
    /\.([a-z\d]{1,12})$/i.exec(file.name)?.[1].toUpperCase() ??
    t('workshop.field.file', locale)
)

// An audio file says nothing as a filename, so the row plays it: the square
// that would hold a thumbnail holds the button, and the line it travels runs
// under the name, inside the same row.
const isAudio = computed(() => file.type.startsWith('audio/'))
const source = useSourceUrl(
  () => file.file,
  () => file.previewUrl
)
const {
  audio,
  playing,
  elapsed,
  duration,
  seekable,
  progress,
  toggle,
  seekToPoint,
  seekByKey,
  readDuration
} = useAudioPlayback(source)
</script>

<template>
  <li
    :class="
      cn(
        'flex min-w-0 items-center gap-3 rounded-xl bg-transparency-white-t4 p-2',
        attention && 'ring-1 ring-primary-comfy-orange'
      )
    "
    :data-attention="attention ? '' : undefined"
  >
    <ImageSourcePreview
      v-if="file.type.startsWith('image/')"
      :file="file.file"
      :src="file.previewUrl"
      :name="file.name"
      :locale
    />
    <VideoSourcePreview
      v-else-if="file.type.startsWith('video/')"
      :file="file.file"
      :src="file.previewUrl"
      :name="file.name"
      :locale
    />
    <button
      v-else-if="isAudio && source"
      type="button"
      :aria-label="`${t(playing ? 'player.pause' : 'player.play', locale)} ${file.name}`"
      class="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-transparency-white-t8 text-primary-warm-white transition-colors outline-none hover:bg-transparency-white-t20 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      data-testid="audio-source-play"
      @click="toggle"
    >
      <component
        :is="playing ? Pause : Play"
        class="size-5 fill-current"
        aria-hidden="true"
      />
    </button>
    <span
      v-else
      class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-transparency-white-t8 text-xs font-bold text-primary-warm-gray"
    >
      {{ fileType }}
    </span>

    <div class="flex min-w-0 flex-1 flex-col gap-1.5">
      <button
        type="button"
        :disabled
        :aria-label="
          t('workshop.field.replaceFile', locale).replace(
            '{name}',
            () => file.name
          )
        "
        class="min-w-0 cursor-pointer truncate text-left text-sm text-primary-warm-white underline-offset-4 hover:underline focus-visible:outline-primary-comfy-yellow"
        @click="$emit('replace')"
      >
        {{ file.name }}
      </button>
      <div v-if="isAudio && source" class="flex items-center gap-2">
        <div
          role="slider"
          tabindex="0"
          :aria-label="`${t('player.seek', locale)} ${file.name}`"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(seekable ? duration : 0)"
          :aria-valuenow="Math.round(elapsed)"
          :aria-valuetext="`${clock(elapsed)} / ${clock(duration)}`"
          class="group/seek min-w-0 flex-1 cursor-pointer py-2 outline-none"
          data-testid="audio-source-line"
          @click="seekToPoint"
          @keydown="seekByKey"
        >
          <div
            class="h-1 rounded-full bg-transparency-white-t20 group-focus-visible/seek:ring-3 group-focus-visible/seek:ring-primary-comfy-yellow/50"
          >
            <div
              class="h-full rounded-full bg-primary-comfy-yellow"
              :style="{ width: `${progress}%` }"
            />
          </div>
        </div>
        <span class="shrink-0 text-2xs text-primary-warm-gray tabular-nums">
          {{ clock(elapsed) }} / {{ clock(duration) }}
        </span>
        <audio
          ref="audio"
          :key="source"
          :src="source"
          preload="none"
          class="hidden"
          @play="playing = true"
          @pause="playing = false"
          @ended="playing = false"
          @timeupdate="elapsed = audio?.currentTime ?? 0"
          @loadedmetadata="readDuration"
          @durationchange="readDuration"
        />
      </div>
    </div>

    <span v-if="file.size" class="shrink-0 text-xs text-primary-warm-gray">{{
      formatSize(file.size)
    }}</span>
    <button
      type="button"
      :disabled
      :aria-label="
        t('workshop.field.removeNamedFile', locale).replace(
          '{name}',
          () => file.name
        )
      "
      class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-primary-warm-gray hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:outline-primary-comfy-yellow"
      @click="$emit('remove')"
    >
      <X class="size-4" aria-hidden="true" />
    </button>
  </li>
</template>
