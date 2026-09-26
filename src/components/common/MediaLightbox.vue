<template>
  <DialogRoot :open="isOpen" @update:open="setOpen">
    <DialogPortal>
      <DialogOverlay class="bg-media-scrim" />
      <DialogContent
        v-if="activeItem"
        aria-modal="true"
        :aria-describedby="undefined"
        class="fixed inset-0 z-1700 flex items-center justify-center outline-none"
        @mousedown.capture="onDialogGestureCapture"
        @click.capture="onDialogGestureCapture"
        @mousedown.self="onBackdropMouseDown"
        @mouseup="onBackdropMouseUp"
        @keydown="handleKeyDown"
      >
        <VisuallyHidden>
          <DialogTitle>{{ $t('g.gallery') }}</DialogTitle>
        </VisuallyHidden>

        <DialogClose as-child>
          <Button
            variant="secondary"
            size="icon-lg"
            class="absolute top-4 right-4 z-10 rounded-full"
            :aria-label="$t('g.close')"
          >
            <i class="icon-[lucide--x] size-5" />
          </Button>
        </DialogClose>

        <Button
          v-if="hasMultiple"
          variant="secondary"
          size="icon-lg"
          class="fixed top-1/2 left-4 z-10 -translate-y-1/2 rounded-full"
          :aria-label="$t('g.previous')"
          @click="navigate(-1)"
        >
          <i class="icon-[lucide--chevron-left] size-6" />
        </Button>

        <div class="flex max-h-full max-w-full items-center justify-center">
          <MediaLightboxItem :item="activeItem" />
        </div>

        <Button
          v-if="hasMultiple"
          variant="secondary"
          size="icon-lg"
          class="fixed top-1/2 right-4 z-10 -translate-y-1/2 rounded-full"
          :aria-label="$t('g.next')"
          @click="navigate(1)"
        >
          <i class="icon-[lucide--chevron-right] size-6" />
        </Button>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogRoot,
  DialogTitle,
  VisuallyHidden
} from 'reka-ui'
import { computed, watch } from 'vue'

import MediaLightboxItem from '@/components/common/MediaLightboxItem.vue'
import Button from '@/components/ui/button/Button.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import type { LightboxItem } from '@/types/lightboxItem'

const { items } = defineProps<{
  readonly items: readonly LightboxItem[]
}>()
const activeIndex = defineModel<number | null>('activeIndex', {
  required: true
})

let openingGestureActive = false
let backdropPressed = false
const activeItem = computed(() =>
  activeIndex.value === null ? undefined : items[activeIndex.value]
)
const isOpen = computed(() => activeItem.value !== undefined)
const hasMultiple = computed(() => items.length > 1)

watch(
  [activeIndex, () => items.length],
  ([index], [previousIndex]) => {
    if (index === null || !items[index]) {
      openingGestureActive = false
      if (index !== null) activeIndex.value = null
      return
    }
    if (previousIndex === null) openingGestureActive = true
  },
  { immediate: true }
)

function setOpen(open: boolean) {
  if (!open) activeIndex.value = null
}

function navigate(direction: number) {
  if (activeIndex.value === null || items.length === 0) return
  activeIndex.value =
    (activeIndex.value + direction + items.length) % items.length
}

function onDialogGestureCapture(event: MouseEvent) {
  if (!openingGestureActive) return
  if (event.detail >= 2) {
    event.stopPropagation()
    event.preventDefault()
    return
  }
  openingGestureActive = false
}

function onBackdropMouseDown() {
  backdropPressed = true
}

function onBackdropMouseUp(event: MouseEvent) {
  if (backdropPressed && event.target === event.currentTarget) {
    activeIndex.value = null
  }
  backdropPressed = false
}

function handleKeyDown(event: KeyboardEvent) {
  const actions: Record<string, () => void> = {
    ArrowLeft: () => navigate(-1),
    ArrowRight: () => navigate(1)
  }
  const action = actions[event.key]
  if (!action) return
  event.preventDefault()
  action()
}
</script>
