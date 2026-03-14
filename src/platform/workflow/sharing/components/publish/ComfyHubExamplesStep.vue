<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <p class="text-sm select-none">
      {{
        $t('comfyHubPublish.examplesDescription', {
          total: MAX_EXAMPLES
        })
      }}
    </p>

    <div
      class="grid gap-2"
      style="grid-template-columns: repeat(auto-fill, 8rem)"
    >
      <!-- Upload tile (hidden when max images reached) -->
      <label
        v-if="showUploadTile"
        tabindex="0"
        role="button"
        :aria-label="$t('comfyHubPublish.uploadExampleImage')"
        class="focus-visible:outline-ring flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-default text-center transition-colors hover:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
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
      <div
        v-for="(image, index) in exampleImages"
        :key="image.id"
        class="group relative aspect-square overflow-hidden rounded-sm"
      >
        <img
          :src="image.url"
          :alt="$t('comfyHubPublish.exampleImage', { index: index + 1 })"
          class="size-full object-cover"
        />
        <Button
          variant="textonly"
          size="icon"
          :aria-label="$t('comfyHubPublish.removeExampleImage')"
          class="absolute top-1 right-1 flex size-6 items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
          @click="removeImage(image.id)"
        >
          <i class="icon-[lucide--x] size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { ExampleImage } from '@/platform/workflow/sharing/types/comfyHubTypes'
import {
  isFileTooLarge,
  MAX_IMAGE_SIZE_MB
} from '@/platform/workflow/sharing/utils/validateFileSize'

const fileInputRef = ref<HTMLInputElement | null>(null)

const MAX_EXAMPLES = 8

const { exampleImages } = defineProps<{
  exampleImages: ExampleImage[]
}>()

const showUploadTile = computed(() => exampleImages.length < MAX_EXAMPLES)

const emit = defineEmits<{
  'update:exampleImages': [value: ExampleImage[]]
}>()

function removeImage(id: string) {
  const image = exampleImages.find((img) => img.id === id)
  if (image) {
    URL.revokeObjectURL(image.url)
  }
  emit(
    'update:exampleImages',
    exampleImages.filter((img) => img.id !== id)
  )
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
