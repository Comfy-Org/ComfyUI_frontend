<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { SpriteImage } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import EditorDropZone from '../app-editor/EditorDropZone.vue'
import EditorUploadSlot from '../app-editor/EditorUploadSlot.vue'
import { CHECKER } from './checker'

const { image, locale = 'en' } = defineProps<{
  image: SpriteImage
  locale?: Locale
}>()

const emit = defineEmits<{ file: [file: File] }>()
</script>

<template>
  <EditorDropZone
    role="region"
    :aria-label="spc('sprite.character', locale)"
    :title="spc('sprite.character.drop', locale)"
    class="flex items-center gap-3 rounded-lg px-1 pt-2 pb-3"
    data-testid="sprite-character"
    @file="emit('file', $event)"
  >
    <span
      :class="
        cn(
          'flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-comfy-ink ring-1 ring-transparency-white-t8',
          CHECKER
        )
      "
    >
      <img :src="image.url" alt="" class="size-full object-contain" />
    </span>
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-[11px] text-primary-warm-gray">{{
        spc('sprite.character', locale)
      }}</span>
      <span class="truncate text-xs text-primary-warm-white">{{
        image.name
      }}</span>
    </span>
    <EditorUploadSlot
      :label="spc('sprite.character.changeLabel', locale)"
      class="h-7 shrink-0 rounded-full bg-transparency-white-t8 px-3 text-xs text-primary-warm-white transition hover:bg-transparency-white-t20 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      @file="emit('file', $event)"
    >
      {{ spc('sprite.character.change', locale) }}
    </EditorUploadSlot>
  </EditorDropZone>
</template>
