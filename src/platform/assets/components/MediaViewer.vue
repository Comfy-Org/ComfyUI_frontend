<template>
  <DialogRoot :open="isOpen" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/80" />
      <DialogContent
        class="fixed inset-0 z-50 flex items-center justify-center outline-none"
        :aria-describedby="undefined"
      >
        <VisuallyHidden as-child>
          <DialogTitle>{{ currentItem?.name ?? '' }}</DialogTitle>
        </VisuallyHidden>

        <!-- Close button -->
        <DialogClose
          class="absolute top-4 right-4 z-10 cursor-pointer rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          :aria-label="$t('g.close')"
        >
          <i class="icon-[lucide--x] size-5" />
        </DialogClose>

        <!-- Previous button -->
        <button
          v-if="hasMultiple"
          class="absolute left-4 z-10 cursor-pointer rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          @click="navigate(-1)"
        >
          <i class="icon-[lucide--chevron-left] size-6" />
        </button>

        <!-- Media content -->
        <ComfyImage
          v-if="currentMediaType === 'image'"
          :key="currentItem?.id"
          :src="currentItem?.preview_url ?? ''"
          :contain="false"
          :alt="currentItem?.name ?? ''"
          class="max-h-screen max-w-full object-contain"
        />
        <video
          v-else-if="currentMediaType === 'video'"
          :key="currentItem?.id"
          :src="currentItem?.preview_url ?? ''"
          controls
          class="max-h-screen max-w-full"
        />
        <audio
          v-else-if="currentMediaType === 'audio'"
          :key="currentItem?.id"
          :src="currentItem?.preview_url ?? ''"
          controls
        />

        <!-- Next button -->
        <button
          v-if="hasMultiple"
          class="absolute right-4 z-10 cursor-pointer rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          @click="navigate(1)"
        >
          <i class="icon-[lucide--chevron-right] size-6" />
        </button>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  VisuallyHidden
} from 'reka-ui'
import { computed, onMounted, onUnmounted } from 'vue'

import ComfyImage from '@/components/common/ComfyImage.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

const { items = [], activeIndex = -1 } = defineProps<{
  items?: AssetItem[]
  activeIndex?: number
}>()

const emit = defineEmits<{
  'update:activeIndex': [value: number]
}>()

const isOpen = computed(() => activeIndex >= 0 && activeIndex < items.length)

const currentItem = computed(() =>
  isOpen.value ? items[activeIndex] : undefined
)

const currentMediaType = computed(() =>
  currentItem.value ? getMediaTypeFromFilename(currentItem.value.name) : ''
)

const hasMultiple = computed(() => items.length > 1)

function handleOpenChange(open: boolean) {
  if (!open) {
    emit('update:activeIndex', -1)
  }
}

function navigate(direction: number) {
  const newIndex = (activeIndex + direction + items.length) % items.length
  emit('update:activeIndex', newIndex)
}

function handleKeyDown(event: KeyboardEvent) {
  if (!isOpen.value) return
  if (event.key === 'ArrowLeft') navigate(-1)
  else if (event.key === 'ArrowRight') navigate(1)
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
</script>
