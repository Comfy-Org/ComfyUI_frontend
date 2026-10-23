<script setup lang="ts">
import { Upload } from '@lucide/vue'

import EditorDropZone from './EditorDropZone.vue'
import EditorUploadSlot from './EditorUploadSlot.vue'

const { title, meta, uploadLabel, exampleLabel, exampleImage } = defineProps<{
  title: string
  meta: string
  uploadLabel: string
  exampleLabel: string
  exampleImage: string
}>()
const emit = defineEmits<{ file: [file: File]; example: [] }>()
</script>

<template>
  <EditorDropZone
    class="flex w-full max-w-120 flex-col items-center gap-5 self-center rounded-2xl border border-dashed border-transparency-white-t20 bg-primary-comfy-ink/70 px-6 py-8 text-center backdrop-blur-sm sm:px-10"
    @file="emit('file', $event)"
  >
    <span
      class="flex size-11 items-center justify-center rounded-xl bg-transparency-white-t8 text-primary-warm-white"
    >
      <Upload class="size-5" aria-hidden="true" />
    </span>
    <span class="flex flex-col gap-1">
      <span class="text-base font-medium text-primary-warm-white">{{
        title
      }}</span>
      <span class="text-xs text-primary-warm-gray">{{ meta }}</span>
    </span>
    <span class="flex flex-wrap items-center justify-center gap-2">
      <EditorUploadSlot
        input-test-id="editor-empty-file"
        class="h-9 rounded-full bg-primary-warm-white px-4 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @file="emit('file', $event)"
      >
        {{ uploadLabel }}
      </EditorUploadSlot>
      <button
        type="button"
        class="flex h-9 items-center gap-2 rounded-full bg-transparency-white-t8 pr-4 pl-1 text-xs text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="emit('example')"
      >
        <img
          :src="exampleImage"
          alt=""
          class="size-7 rounded-full object-cover"
        />
        {{ exampleLabel }}
      </button>
    </span>
  </EditorDropZone>
</template>
