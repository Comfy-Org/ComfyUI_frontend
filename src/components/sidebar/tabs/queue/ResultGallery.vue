<template>
  <Teleport to="body">
    <div
      v-if="galleryVisible"
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('g.gallery')"
      tabindex="-1"
      class="fixed inset-0 z-9999 flex items-center justify-center bg-black/90 outline-none"
      data-mask
      @mousedown="onMaskMouseDown"
      @mouseup="onMaskMouseUp"
    >
      <!-- Close Button -->
      <Button
        variant="secondary"
        size="icon-lg"
        class="absolute top-4 right-4 z-10 rounded-full"
        :aria-label="$t('g.close')"
        @click="close"
      >
        <i class="icon-[lucide--x] size-5" />
      </Button>

      <!-- Previous Button -->
      <Button
        v-if="hasMultiple"
        variant="secondary"
        size="icon-lg"
        class="fixed top-1/2 left-4 z-10 -translate-y-1/2 rounded-full"
        :aria-label="$t('g.previous')"
        @click="navigateImage(-1)"
      >
        <i class="icon-[lucide--chevron-left] size-6" />
      </Button>

      <!-- Content -->
      <div class="flex max-h-full max-w-full items-center justify-center">
        <template v-if="activeItem">
          <ComfyImage
            v-if="activeItem.isImage"
            :key="activeItem.url"
            :src="activeItem.url"
            :contain="false"
            :alt="activeItem.filename"
            class="size-auto max-h-[90vh] max-w-[90vw] object-contain"
          />
          <ResultVideo v-else-if="activeItem.isVideo" :result="activeItem" />
          <ResultAudio v-else-if="activeItem.isAudio" :result="activeItem" />
        </template>
      </div>

      <!-- Next Button -->
      <Button
        v-if="hasMultiple"
        variant="secondary"
        size="icon-lg"
        class="fixed top-1/2 right-4 z-10 -translate-y-1/2 rounded-full"
        :aria-label="$t('g.next')"
        @click="navigateImage(1)"
      >
        <i class="icon-[lucide--chevron-right] size-6" />
      </Button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'

import ComfyImage from '@/components/common/ComfyImage.vue'
import Button from '@/components/ui/button/Button.vue'
import type { ResultItemImpl } from '@/stores/queueStore'

import ResultAudio from './ResultAudio.vue'
import ResultVideo from './ResultVideo.vue'

const emit = defineEmits<{
  (e: 'update:activeIndex', value: number): void
}>()

const props = defineProps<{
  allGalleryItems: ResultItemImpl[]
  activeIndex: number
}>()

const galleryVisible = ref(false)
const dialogRef = ref<HTMLElement>()
let previouslyFocusedElement: HTMLElement | null = null
const hasMultiple = computed(() => props.allGalleryItems.length > 1)
const activeItem = computed(() => props.allGalleryItems[props.activeIndex])

watch(
  () => props.activeIndex,
  (index) => {
    galleryVisible.value = index !== -1
    if (index !== -1) {
      previouslyFocusedElement = document.activeElement as HTMLElement | null
      void nextTick(() => dialogRef.value?.focus())
    }
  },
  { immediate: true }
)

function close() {
  galleryVisible.value = false
  emit('update:activeIndex', -1)
  previouslyFocusedElement?.focus()
  previouslyFocusedElement = null
}

function navigateImage(direction: number) {
  const newIndex =
    (props.activeIndex + direction + props.allGalleryItems.length) %
    props.allGalleryItems.length
  emit('update:activeIndex', newIndex)
}

let maskMouseDownTarget: EventTarget | null = null

function onMaskMouseDown(event: MouseEvent) {
  maskMouseDownTarget = event.target
}

function onMaskMouseUp(event: MouseEvent) {
  if (
    maskMouseDownTarget === event.target &&
    (event.target as HTMLElement)?.hasAttribute('data-mask')
  ) {
    close()
  }
}

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!galleryVisible.value) return

  const actions: Record<string, () => void> = {
    ArrowLeft: () => navigateImage(-1),
    ArrowRight: () => navigateImage(1),
    Escape: () => close()
  }

  const action = actions[event.key]
  if (action) {
    event.preventDefault()
    action()
  }
})
</script>
