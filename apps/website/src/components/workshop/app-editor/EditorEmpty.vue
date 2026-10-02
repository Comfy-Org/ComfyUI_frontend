<script setup lang="ts">
import { Upload } from '@lucide/vue'
import { useTemplateRef } from 'vue'

const { title, meta, uploadLabel, exampleLabel, exampleImage } = defineProps<{
  title: string
  meta: string
  uploadLabel: string
  exampleLabel: string
  exampleImage: string
}>()
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
    class="flex w-full max-w-120 flex-col items-center gap-5 self-center rounded-2xl border border-dashed border-transparency-white-t20 bg-primary-comfy-ink/70 px-6 py-8 text-center backdrop-blur-sm sm:px-10"
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
        title
      }}</span>
      <span class="text-xs text-primary-warm-gray">{{ meta }}</span>
    </span>
    <span class="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        class="h-9 rounded-full bg-primary-warm-white px-4 text-xs font-semibold text-primary-comfy-ink focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="input?.click()"
      >
        {{ uploadLabel }}
      </button>
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
    <input
      ref="input"
      type="file"
      data-testid="editor-empty-file"
      accept="image/png,image/jpeg,image/webp"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="onChange"
    />
  </div>
</template>
