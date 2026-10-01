<script setup lang="ts">
import { Upload } from '@lucide/vue'

import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import { PAPARAZZI_EXAMPLE } from '../../../lib/workshop/paparazzi-me/mock-run'

const { disabled = false, locale = 'en' } = defineProps<{
  disabled?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ upload: []; example: [] }>()
</script>

<template>
  <div
    class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-transparency-white-t20 px-2 py-3 text-center"
  >
    <Upload class="size-4 text-primary-warm-white" aria-hidden="true" />
    <span class="flex flex-col">
      <span class="text-xs font-medium text-primary-warm-white">{{
        pc('paparazzi.face.empty', locale)
      }}</span>
      <span class="text-[10px] text-primary-warm-gray">{{
        pc('paparazzi.face.meta', locale)
      }}</span>
    </span>
    <button
      type="button"
      :disabled
      class="h-7 w-full rounded-full bg-primary-warm-white text-[11px] font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      @click="emit('upload')"
    >
      {{ pc('paparazzi.face.upload', locale) }}
    </button>
    <button
      type="button"
      :disabled
      class="flex h-7 w-full items-center justify-center gap-1.5 rounded-full bg-transparency-white-t8 text-[11px] text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      @click="emit('example')"
    >
      <img
        :src="PAPARAZZI_EXAMPLE.url"
        alt=""
        class="size-5 rounded-full object-cover"
      />
      {{ pc('paparazzi.face.example', locale) }}
    </button>
  </div>
</template>
