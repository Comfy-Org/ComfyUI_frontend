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
      role="list"
      class="group/grid grid gap-2"
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

      <!-- Example images (drag to reorder) -->
      <ReorderableExampleImage
        v-for="(image, index) in exampleImages"
        :key="image.id"
        :image="image"
        :index="index"
        :total="exampleImages.length"
        :instance-id="instanceId"
        @remove="removeImage"
        @move="moveImage"
        @insert-files="insertImagesAt"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { ExampleImage } from '@/platform/workflow/sharing/types/comfyHubTypes'
import {
  isFileTooLarge,
  MAX_IMAGE_SIZE_MB
} from '@/platform/workflow/sharing/utils/validateFileSize'
import ReorderableExampleImage from './ReorderableExampleImage.vue'

const fileInputRef = ref<HTMLInputElement | null>(null)

const MAX_EXAMPLES = 8

const exampleImages = defineModel<ExampleImage[]>('exampleImages', {
  required: true
})

const showUploadTile = computed(() => exampleImages.value.length < MAX_EXAMPLES)

const instanceId = Symbol('example-images')

let cleanupMonitor = () => {}

onMounted(() => {
  cleanupMonitor = monitorForElements({
    canMonitor: ({ source }) => source.data.instanceId === instanceId,
    onDrop: ({ source, location }) => {
      const destination = location.current.dropTargets[0]
      if (!destination) return

      const fromId = source.data.imageId
      const toId = destination.data.imageId
      if (typeof fromId !== 'string' || typeof toId !== 'string') return

      reorderImages(fromId, toId)
    }
  })
})

onBeforeUnmount(() => {
  cleanupMonitor()
})

function moveByIndex(fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0) return
  if (toIndex >= exampleImages.value.length || fromIndex === toIndex) return

  const updated = [...exampleImages.value]
  const [moved] = updated.splice(fromIndex, 1)
  updated.splice(toIndex, 0, moved)
  exampleImages.value = updated
}

function reorderImages(fromId: string, toId: string) {
  moveByIndex(
    exampleImages.value.findIndex((img) => img.id === fromId),
    exampleImages.value.findIndex((img) => img.id === toId)
  )
}

function moveImage(id: string, direction: number) {
  const currentIndex = exampleImages.value.findIndex((img) => img.id === id)
  moveByIndex(currentIndex, currentIndex + direction)
}

function removeImage(id: string) {
  const image = exampleImages.value.find((img) => img.id === id)
  if (image?.file) {
    URL.revokeObjectURL(image.url)
  }
  exampleImages.value = exampleImages.value.filter((img) => img.id !== id)
}

function createExampleImages(files: FileList): ExampleImage[] {
  return Array.from(files)
    .filter((f) => f.type.startsWith('image/'))
    .filter((f) => !isFileTooLarge(f, MAX_IMAGE_SIZE_MB))
    .map((file) => ({
      id: uuidv4(),
      url: URL.createObjectURL(file),
      file
    }))
}

function addImages(files: FileList) {
  const remaining = MAX_EXAMPLES - exampleImages.value.length
  if (remaining <= 0) return

  const created = createExampleImages(files)
  const newImages = created.slice(0, remaining)
  for (const img of created.slice(remaining)) {
    URL.revokeObjectURL(img.url)
  }
  if (newImages.length > 0) {
    exampleImages.value = [...newImages, ...exampleImages.value]
  }
}

function insertImagesAt(index: number, files: FileList) {
  const created = createExampleImages(files)
  if (created.length === 0) return

  const updated = [...exampleImages.value]
  const safeIndex = Math.min(Math.max(index, 0), updated.length)
  const remaining = MAX_EXAMPLES - exampleImages.value.length
  const maxInsert =
    remaining <= 0 ? Math.max(updated.length - safeIndex, 0) : remaining
  const newImages = created.slice(0, maxInsert)
  for (const img of created.slice(maxInsert)) {
    URL.revokeObjectURL(img.url)
  }

  if (newImages.length === 0) return
  if (remaining <= 0) {
    const replacedImages = updated.splice(
      safeIndex,
      newImages.length,
      ...newImages
    )
    for (const img of replacedImages) {
      if (img.file) URL.revokeObjectURL(img.url)
    }
  } else {
    updated.splice(safeIndex, 0, ...newImages)
  }

  exampleImages.value = updated
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
