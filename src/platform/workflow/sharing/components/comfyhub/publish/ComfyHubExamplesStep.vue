<template>
  <div class="flex min-h-0 flex-1 flex-col gap-6 px-6 py-4">
    <p class="text-sm text-muted-foreground">
      {{
        $t('comfyHubPublish.examplesDescription', {
          selected: selectedExampleIds.length,
          total: MAX_EXAMPLES
        })
      }}
    </p>

    <div class="grid grid-cols-4 gap-2.5 overflow-y-auto">
      <!-- Upload tile -->
      <label
        class="flex h-[100px] aspect-square text-center cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-default transition-colors hover:border-muted-foreground"
        @dragover.prevent
        @drop.prevent="handleFileDrop"
      >
        <input
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="handleFileSelect"
        />
        <span class="text-sm text-muted-foreground">
          {{ $t('comfyHubPublish.uploadAnImage') }}
        </span>
        <i class="icon-[lucide--image] size-4 text-muted-foreground" />
      </label>

      <!-- Example images -->
      <button
        v-for="image in exampleImages"
        :key="image.id"
        :class="
          cn(
            'relative h-[100px] cursor-pointer overflow-hidden rounded border-none p-0',
            isSelected(image.id) ? 'ring-2 ring-blue-500' : 'ring-0'
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
          class="absolute bottom-1.5 left-1.5 flex size-7 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white"
        >
          {{ selectionIndex(image.id) }}
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'

import type { ExampleImage } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { cn } from '@/utils/tailwindUtil'

const MAX_EXAMPLES = 8

const { exampleImages, selectedExampleIds } = defineProps<{
  exampleImages: ExampleImage[]
  selectedExampleIds: string[]
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
</script>
