<template>
  <Teleport to="body">
    <FocusScope
      v-if="galleryVisible"
      as-child
      trapped
      loop
      @mount-auto-focus.prevent
      @unmount-auto-focus.prevent
    >
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('g.gallery')"
        tabindex="-1"
        class="fixed inset-0 z-9999 flex items-center justify-center bg-black/90 outline-none"
        data-mask
        @mousedown.capture="onDialogGestureCapture"
        @click.capture="onDialogGestureCapture"
        @mousedown="onMaskMouseDown"
        @mouseup="onMaskMouseUp"
        @keydown.stop="handleKeyDown"
      >
        <Button
          variant="secondary"
          size="icon-lg"
          class="absolute top-4 right-4 z-10 rounded-full"
          :aria-label="$t('g.close')"
          @click="close"
        >
          <i class="icon-[lucide--x] size-5" />
        </Button>

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

        <div class="flex max-h-full max-w-full items-center justify-center">
          <MediaLightboxItem v-if="activeItem" :item="activeItem" />
        </div>

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
    </FocusScope>
  </Teleport>
</template>

<script setup lang="ts">
import { FocusScope } from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'

import MediaLightboxItem from '@/components/common/MediaLightboxItem.vue'
import Button from '@/components/ui/button/Button.vue'
import type { AugmentedResultItem } from '@/utils/resultItem'

const emit = defineEmits<{
  (e: 'update:activeIndex', value: number): void
}>()

const { allGalleryItems, activeIndex } = defineProps<{
  readonly allGalleryItems: AugmentedResultItem[]
  readonly activeIndex: number
}>()

const galleryVisible = ref(false)
const dialogRef = ref<HTMLElement>()
let previouslyFocusedElement: HTMLElement | null = null
let openingGestureActive = false
const hasMultiple = computed(() => allGalleryItems.length > 1)
const activeItem = computed(() => allGalleryItems[activeIndex])

watch(
  () => activeIndex,
  (index, previousIndex) => {
    galleryVisible.value = index !== -1
    if (index === -1) {
      openingGestureActive = false
      const opener = previouslyFocusedElement
      previouslyFocusedElement = null
      void nextTick(() => {
        if (opener?.isConnected) opener.focus()
      })
      return
    }
    if (previousIndex !== undefined && previousIndex !== -1) return
    openingGestureActive = true
    const opener = document.activeElement
    previouslyFocusedElement = opener instanceof HTMLElement ? opener : null
    void nextTick(() => dialogRef.value?.focus())
  },
  { immediate: true }
)

function close() {
  galleryVisible.value = false
  emit('update:activeIndex', -1)
}

function navigateImage(direction: number) {
  const newIndex =
    (activeIndex + direction + allGalleryItems.length) % allGalleryItems.length
  emit('update:activeIndex', newIndex)
}

let maskMouseDownTarget: EventTarget | null = null

function onDialogGestureCapture(event: MouseEvent) {
  if (!openingGestureActive) return
  if (event.detail >= 2) {
    event.stopPropagation()
    event.preventDefault()
    return
  }
  openingGestureActive = false
}

function onMaskMouseDown(event: MouseEvent) {
  maskMouseDownTarget = event.target
}

function onMaskMouseUp(event: MouseEvent) {
  if (
    maskMouseDownTarget === event.target &&
    event.target instanceof Element &&
    event.target.hasAttribute('data-mask')
  ) {
    close()
  }
}

function handleKeyDown(event: KeyboardEvent) {
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
}
</script>
