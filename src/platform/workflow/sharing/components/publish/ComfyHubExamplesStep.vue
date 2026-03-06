<template>
  <div class="flex min-h-0 flex-1 flex-col gap-6">
    <p class="text-sm">
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
        tabindex="0"
        role="button"
        :aria-label="$t('comfyHubPublish.uploadExampleImage')"
        class="focus-visible:outline-ring flex aspect-square h-25 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-default text-center transition-colors hover:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
        @dragenter.stop
        @dragleave.stop
        @dragover.prevent.stop
        @drop.prevent.stop="handleFileDrop"
        @keydown.enter.prevent="fileInputRef?.click()"
        @keydown.space.prevent="fileInputRef?.click()"
      >
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="handleFileSelect"
        />
        <i
          class="icon-[lucide--plus] size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <span class="sr-only">{{
          $t('comfyHubPublish.uploadExampleImage')
        }}</span>
      </label>

      <!-- Example images -->
      <Button
        v-for="(image, index) in exampleImages"
        :key="image.id"
        variant="textonly"
        size="unset"
        :class="
          cn(
            'relative h-25 cursor-pointer overflow-hidden rounded-sm p-0',
            isSelected(image.id) ? 'ring-ring ring-2' : 'ring-0'
          )
        "
        @click="toggleSelection(image.id)"
      >
        <img
          :src="image.url"
          :alt="$t('comfyHubPublish.exampleImage', { index: index + 1 })"
          class="size-full object-cover"
        />
        <div
          v-if="isSelected(image.id)"
          class="absolute bottom-1.5 left-1.5 flex size-7 items-center justify-center rounded-full bg-primary-background text-sm font-bold text-base-foreground"
        >
          {{ selectionIndex(image.id) }}
        </div>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { ExampleImage } from '@/platform/workflow/sharing/types/comfyHubTypes'
import {
  isFileTooLarge,
  MAX_IMAGE_SIZE_MB
} from '@/platform/workflow/sharing/utils/validateFileSize'
import { cn } from '@/utils/tailwindUtil'

const fileInputRef = ref<HTMLInputElement | null>(null)

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
    .filter((f) => !isFileTooLarge(f, MAX_IMAGE_SIZE_MB))
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
  if (!(event.target instanceof HTMLInputElement)) return
  if (event.target.files?.length) {
    addImages(event.target.files)
  }
}

function handleFileDrop(event: DragEvent) {
  if (event.dataTransfer?.files?.length) {
    addImages(event.dataTransfer.files)
  }
}
</script>
