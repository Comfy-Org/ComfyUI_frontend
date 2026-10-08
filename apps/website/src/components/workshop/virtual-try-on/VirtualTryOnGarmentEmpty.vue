<script setup lang="ts">
import { Shirt } from '@lucide/vue'

import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorUploadSlot from '../app-editor/EditorUploadSlot.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const emit = defineEmits<{ file: [file: File] }>()
</script>

<template>
  <div
    class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-transparency-white-t20 bg-primary-comfy-ink/80 px-2 py-3 text-center backdrop-blur-md"
  >
    <Shirt class="size-4 text-primary-warm-gray" aria-hidden="true" />
    <span class="text-[11px] leading-tight text-primary-warm-white">{{
      vc('tryOn.garment.empty', locale)
    }}</span>
    <span
      class="text-[10px] leading-tight text-primary-warm-gray max-sm:hidden"
      >{{ vc('tryOn.garment.emptyMeta', locale) }}</span
    >
    <EditorUploadSlot
      class="h-7 rounded-full bg-primary-warm-white px-3 text-[11px] font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      @file="(file) => emit('file', file)"
    >
      {{ vc('tryOn.garment.choose', locale) }}
    </EditorUploadSlot>
  </div>
</template>
