<script setup lang="ts">
import { Upload } from '@lucide/vue'
import { useTemplateRef } from 'vue'

import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import { MOVE_EXAMPLE } from '../../../lib/workshop/move-anything/mock-run'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const emit = defineEmits<{ file: [file: File]; example: [] }>()

const input = useTemplateRef<HTMLInputElement>('input')

function pick(files: FileList | null | undefined) {
  const file = files?.[0]
  if (file?.type.startsWith('image/')) emit('file', file)
}

function onChange(event: Event) {
  if (event.target instanceof HTMLInputElement) pick(event.target.files)
}
</script>

<template>
  <div
    class="flex size-full max-w-180 flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-transparency-white-t20 p-6 text-center"
    data-testid="move-empty"
    @dragover.prevent
    @drop.prevent="pick($event.dataTransfer?.files)"
  >
    <span
      class="flex size-11 items-center justify-center rounded-xl bg-transparency-white-t8 text-primary-warm-white"
    >
      <Upload class="size-5" aria-hidden="true" />
    </span>
    <span class="flex flex-col gap-1">
      <span class="text-base font-medium text-primary-warm-white">{{
        mc('move.empty.title', locale)
      }}</span>
      <span class="text-xs text-primary-warm-gray">{{
        mc('move.empty.meta', locale)
      }}</span>
    </span>
    <span class="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        class="h-9 rounded-full bg-primary-warm-white px-4 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="input?.click()"
      >
        {{ mc('move.empty.upload', locale) }}
      </button>
      <button
        type="button"
        class="flex h-9 items-center gap-2 rounded-full bg-transparency-white-t8 pr-4 pl-1 text-xs text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="emit('example')"
      >
        <img
          :src="MOVE_EXAMPLE.url"
          alt=""
          class="size-7 rounded-full object-cover"
        />
        {{ mc('move.empty.example', locale) }}
      </button>
    </span>
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="onChange"
    />
  </div>
</template>
