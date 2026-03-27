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
    @pointerdown="tileRef && focusVisible(tileRef)"
    @keydown.left.prevent="handleArrowKey(-1, $event)"
    @keydown.right.prevent="handleArrowKey(1, $event)"
    @keydown.delete.prevent="handleRemove"
    @keydown.backspace.prevent="handleRemove"
    @dragover.prevent.stop
    @drop.prevent.stop="handleFileDrop"
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
  insertFiles: [index: number, files: FileList]
}>()

// focusVisible is a Chromium 122+ extension to FocusOptions
// (not yet in TypeScript's lib.dom.d.ts)
function focusVisible(el: HTMLElement) {
  el.focus({ focusVisible: true } as FocusOptions)
}

async function handleArrowKey(direction: number, event: KeyboardEvent) {
  if (event.shiftKey) {
    emit('move', image.id, direction)
    await nextTick()
    if (tileRef.value) focusVisible(tileRef.value)
  } else {
    focusSibling(direction)
  }
}

function focusSibling(direction: number) {
  const sibling =
    direction < 0
      ? tileRef.value?.previousElementSibling
      : tileRef.value?.nextElementSibling
  if (sibling instanceof HTMLElement) focusVisible(sibling)
}

async function handleRemove() {
  const next =
    tileRef.value?.nextElementSibling ?? tileRef.value?.previousElementSibling
  emit('remove', image.id)
  await nextTick()
  if (next instanceof HTMLElement) focusVisible(next)
}

function handleFileDrop(event: DragEvent) {
  if (event.dataTransfer?.files?.length) {
    emit('insertFiles', index, event.dataTransfer.files)
  }
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
