<template>
  <div :class="containerClass">
    <div class="text-sm">
      {{
        $t('comfyHubPublish.examplesDescription', {
          selected: selectedExampleIds.length,
          total: MAX_EXAMPLES
        })
      }}
    </div>

    <div class="grid grid-cols-4 gap-2.5 overflow-y-auto">
      <!-- Upload tile -->
      <label
        class="flex h-25 aspect-square text-center cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-default transition-colors hover:border-muted-foreground"
        @dragenter.stop
        @dragleave.stop
        @dragover.prevent.stop
        @drop.prevent.stop="handleFileDrop"
      >
        <input
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="handleFileSelect"
        />
        <i class="icon-[lucide--plus] size-4 text-muted-foreground" />
      </label>

      <!-- Example images -->
      <button
        v-for="image in exampleImages"
        :key="image.id"
        :class="
          cn(
            'relative h-[100px] cursor-pointer overflow-hidden rounded border-none p-0',
            isSelected(image.id) ? 'ring-2 ring-ring' : 'ring-0'
          )
        "
        @click="toggleSelection(image.id)"
      >
        <img
          :src="image.url"
          :alt="image.id"
          class="h-full w-full object-cover"
        />
        <div
          v-if="isSelected(image.id)"
          class="absolute bottom-1.5 left-1.5 flex size-7 items-center justify-center rounded-full bg-primary-background text-sm font-bold text-base-foreground"
        >
          {{ selectionIndex(image.id) }}
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'
import { computed } from 'vue'

import type { ExampleImage } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { cn } from '@/utils/tailwindUtil'

const MAX_EXAMPLES = 8

const {
  exampleImages,
  selectedExampleIds,
  embedded = false
} = defineProps<{
  exampleImages: ExampleImage[]
  selectedExampleIds: string[]
  embedded?: boolean
}>()

const emit = defineEmits<{
  'update:exampleImages': [value: ExampleImage[]]
  'update:selectedExampleIds': [value: string[]]
}>()

function isSelected(id: string): boolean {
  return selectedExampleIds.includes(id)
}

function selectionIndex(id: string): number {
  return selectedExampleIds.indexOf(id) + 1
}

function toggleSelection(id: string) {
  if (isSelected(id)) {
    emit(
      'update:selectedExampleIds',
      selectedExampleIds.filter((sid) => sid !== id)
    )
  } else if (selectedExampleIds.length < MAX_EXAMPLES) {
    emit('update:selectedExampleIds', [...selectedExampleIds, id])
  }
}

function addImages(files: FileList) {
  const newImages: ExampleImage[] = Array.from(files)
    .filter((f) => f.type.startsWith('image/'))
    .map((file) => ({
      id: uuidv4(),
      url: URL.createObjectURL(file),
      file
    }))

  if (newImages.length > 0) {
    emit('update:exampleImages', [...exampleImages, ...newImages])
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    addImages(input.files)
  }
}

function handleFileDrop(event: DragEvent) {
  if (event.dataTransfer?.files?.length) {
    addImages(event.dataTransfer.files)
  }
}

const containerClass = computed(() =>
  cn('flex min-h-0 flex-1 flex-col gap-6', embedded ? 'px-0 py-0' : 'px-6 py-4')
)
</script>
