<script setup lang="ts">
import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import EditorDropZone from '@/components/workshop/app-editor/EditorDropZone.vue'
import EditorUploadSlot from '@/components/workshop/app-editor/EditorUploadSlot.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { face } = paparazzi
</script>

<template>
  <EditorDropZone
    class="flex flex-col gap-1.5 rounded-lg px-1 pt-2 pb-3"
    data-testid="paparazzi-face"
    @file="paparazzi.useFaceFile"
  >
    <div class="flex items-center gap-3">
      <img
        :src="face.url"
        alt=""
        class="size-10 rounded-lg object-cover object-[60%_30%]"
      />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-[11px] text-primary-warm-gray">{{
          pc('paparazzi.face', locale)
        }}</span>
        <span class="truncate text-xs text-primary-warm-white">{{
          face.name
        }}</span>
      </span>
      <EditorUploadSlot
        :label="pc('paparazzi.face.changeLabel', locale)"
        input-test-id="paparazzi-face-input"
        class="h-7 shrink-0 rounded-full bg-transparency-white-t8 px-3 text-xs text-primary-warm-white transition hover:bg-transparency-white-t20 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
        @file="paparazzi.useFaceFile"
      >
        {{ pc('paparazzi.face.change', locale) }}
      </EditorUploadSlot>
    </div>
    <p class="text-[11px] text-primary-warm-gray">
      {{ pc('paparazzi.face.tip', locale) }}
    </p>
  </EditorDropZone>
</template>
