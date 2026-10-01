<script setup lang="ts">
import { useTemplateRef } from 'vue'

import type { MoveImage } from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'

const { image, locale = 'en' } = defineProps<{
  image: MoveImage
  locale?: Locale
}>()

const emit = defineEmits<{ file: [file: File] }>()
const input = useTemplateRef<HTMLInputElement>('input')

function onPick(event: Event) {
  const file =
    event.target instanceof HTMLInputElement
      ? event.target.files?.[0]
      : undefined
  if (file?.type.startsWith('image/')) emit('file', file)
}
</script>

<template>
  <div class="flex items-center gap-3 px-1 pt-2 pb-1">
    <img :src="image.url" alt="" class="size-10 rounded-lg object-cover" />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate text-xs text-primary-warm-white">{{
        image.name
      }}</span>
      <span class="text-[11px] text-primary-warm-gray tabular-nums">{{
        mc('move.image.size', locale, {
          width: image.width,
          height: image.height
        })
      }}</span>
    </span>
    <button
      type="button"
      :aria-label="mc('move.change', locale)"
      class="h-7 shrink-0 rounded-full bg-transparency-white-t8 px-3 text-xs text-primary-warm-white transition hover:bg-transparency-white-t20 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      @click="input?.click()"
    >
      {{ mc('move.image.change', locale) }}
    </button>
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="onPick"
    />
  </div>
</template>
