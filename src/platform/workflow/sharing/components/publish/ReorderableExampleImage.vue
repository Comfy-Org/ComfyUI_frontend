<template>
  <div
    ref="tileRef"
    :class="
      cn(
        'group focus-visible:outline-ring relative aspect-square overflow-hidden rounded-sm outline-offset-2 focus-visible:outline-2',
        state === 'dragging' && 'opacity-40',
        state === 'over' && 'ring-2 ring-primary'
      )
    "
    tabindex="0"
    role="listitem"
    :aria-label="
      $t('comfyHubPublish.exampleImagePosition', {
        index: index + 1,
        total: total
      })
    "
    @pointerdown="tileRef?.focus()"
    @keydown.left.prevent="handleMove(-1)"
    @keydown.right.prevent="handleMove(1)"
    @keydown.delete.prevent="$emit('remove', image.id)"
    @keydown.backspace.prevent="$emit('remove', image.id)"
  >
    <img
      :src="image.url"
      :alt="$t('comfyHubPublish.exampleImage', { index: index + 1 })"
      class="pointer-events-none size-full object-cover"
      draggable="false"
    />
    <Button
      variant="textonly"
      size="icon"
      :aria-label="$t('comfyHubPublish.removeExampleImage')"
      tabindex="-1"
      class="absolute top-1 right-1 flex size-6 items-center justify-center bg-black/60 text-white opacity-0 transition-opacity not-group-has-focus-visible/grid:group-hover:opacity-100 group-focus-visible:opacity-100 hover:bg-black/80"
      @click="$emit('remove', image.id)"
    >
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import { nextTick, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import {
  usePragmaticDraggable,
  usePragmaticDroppable
} from '@/composables/usePragmaticDragAndDrop'
import type { ExampleImage } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { cn } from '@/utils/tailwindUtil'

const { image, index, total, instanceId } = defineProps<{
  image: ExampleImage
  index: number
  total: number
  instanceId: symbol
}>()

const emit = defineEmits<{
  remove: [id: string]
  move: [id: string, direction: number]
}>()

async function handleMove(direction: number) {
  emit('move', image.id, direction)
  await nextTick()
  tileRef.value?.focus()
}

const tileRef = ref<HTMLElement | null>(null)

type DragState = 'idle' | 'dragging' | 'over'
const state = ref<DragState>('idle')

const tileGetter = () => tileRef.value as HTMLElement

usePragmaticDraggable(tileGetter, {
  getInitialData: () => ({
    type: 'example-image',
    imageId: image.id,
    instanceId
  }),
  onGenerateDragPreview: ({ nativeSetDragImage }) => {
    setCustomNativeDragPreview({
      nativeSetDragImage,
      render: ({ container }) => {
        const img = tileRef.value?.querySelector('img')
        if (!img) return
        const preview = img.cloneNode(true) as HTMLImageElement
        preview.style.width = '8rem'
        preview.style.height = '8rem'
        preview.style.objectFit = 'cover'
        preview.style.borderRadius = '4px'
        container.appendChild(preview)
      }
    })
  },
  onDragStart: () => {
    state.value = 'dragging'
  },
  onDrop: () => {
    state.value = 'idle'
  }
})

usePragmaticDroppable(tileGetter, {
  getData: () => ({ imageId: image.id }),
  canDrop: ({ source }) =>
    source.data.instanceId === instanceId &&
    source.data.type === 'example-image' &&
    source.data.imageId !== image.id,
  onDragEnter: () => {
    state.value = 'over'
  },
  onDragLeave: () => {
    state.value = 'idle'
  },
  onDrop: () => {
    state.value = 'idle'
  }
})
</script>
