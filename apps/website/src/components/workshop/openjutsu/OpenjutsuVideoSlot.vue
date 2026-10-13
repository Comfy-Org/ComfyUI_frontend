<script setup lang="ts">
import { Film, Scissors, X } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import OpenjutsuVideoInput from './OpenjutsuVideoInput.vue'

/**
 * The video at the top of the panel: an upload button until one is chosen,
 * then its cover with the name over it and a ✕ to take it out. A video longer
 * than a run takes gets one quiet line saying which part is used.
 */
const {
  src,
  caption,
  partNote,
  locale = 'en'
} = defineProps<{
  src?: string
  /** The name and length, shown over the cover. */
  caption?: string
  /** Which part of a long video is used; absent when all of it fits. */
  partNote?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ file: [file: File]; remove: []; trim: [] }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-if="src"
      class="relative aspect-video overflow-hidden rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink"
    >
      <video
        :src
        muted
        playsinline
        preload="metadata"
        aria-hidden="true"
        class="size-full object-cover"
      />
      <span
        class="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-primary-comfy-ink/85 to-transparent px-2.5 pt-6 pb-2 text-xs text-primary-warm-white"
        data-testid="openjutsu-video-caption"
      >
        {{ caption }}
      </span>
      <button
        type="button"
        :aria-label="t('openjutsu.video.remove')"
        class="absolute top-2 right-2 grid size-7 cursor-pointer place-items-center rounded-full bg-primary-comfy-ink/85 text-primary-warm-white transition hover:bg-primary-comfy-ink focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="emit('remove')"
      >
        <X class="size-3.5" aria-hidden="true" />
      </button>
    </div>
    <OpenjutsuVideoInput
      v-else
      class="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-transparency-white-t20 text-primary-warm-gray hover:border-primary-warm-white/50 hover:text-primary-warm-white"
      input-test-id="openjutsu-video-file"
      @file="emit('file', $event)"
    >
      <Film class="size-5" aria-hidden="true" />
      <span class="text-sm text-primary-warm-white">
        {{ t('openjutsu.video.add') }}
      </span>
      <span class="text-xs">{{ t('openjutsu.video.limits') }}</span>
    </OpenjutsuVideoInput>
    <p
      v-if="src && partNote"
      class="flex items-center gap-1.5 text-xs text-primary-warm-gray"
      data-testid="openjutsu-part"
    >
      <Scissors class="size-3.5 shrink-0" aria-hidden="true" />
      <span class="min-w-0 flex-1">{{ partNote }}</span>
      <button
        type="button"
        class="shrink-0 cursor-pointer text-primary-warm-white underline underline-offset-2 hover:text-primary-comfy-yellow focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        :aria-label="t('openjutsu.trim.changeLabel')"
        @click="emit('trim')"
      >
        {{ t('openjutsu.trim.change') }}
      </button>
    </p>
  </div>
</template>
