<template>
  <div
    class="widget-expands relative h-full w-full"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div
      ref="containerEl"
      class="relative h-full w-full overflow-hidden rounded-[5px] bg-node-component-surface"
    >
      <div v-if="isLoading" class="flex size-full items-center justify-center">
        <span class="text-sm">{{ $t('imageCrop.loading') }}</span>
      </div>

      <div
        v-else-if="!imageUrl"
        class="flex size-full flex-col items-center justify-center text-center"
      >
        <i class="mb-2 icon-[lucide--image] h-12 w-12" />
        <p class="text-sm">{{ $t('imageCrop.noInputImage') }}</p>
      </div>

      <img
        v-else
        ref="imageEl"
        :src="imageUrl"
        :alt="$t('imageCrop.cropPreviewAlt')"
        draggable="false"
        class="block size-full object-contain select-none brightness-50"
        @load="handleImageLoad"
        @error="handleImageError"
        @dragstart.prevent
      />

      <div
        v-if="imageUrl && !isLoading"
        class="absolute box-border cursor-move overflow-hidden border-2 border-white"
        :style="cropBoxStyle"
        @pointerdown="handleDragStart"
        @pointermove="handleDragMove"
        @pointerup="handleDragEnd"
      >
        <div class="pointer-events-none size-full" :style="cropImageStyle" />
      </div>

      <div
        v-for="handle in resizeHandles"
        v-show="imageUrl && !isLoading"
        :key="handle.direction"
        :class="['absolute', handle.class]"
        :style="handle.style"
        @pointerdown="(e) => handleResizeStart(e, handle.direction)"
        @pointermove="handleResizeMove"
        @pointerup="handleResizeEnd"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { useImageCrop } from '@/composables/useImageCrop'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'

const props = defineProps<{
  nodeId: NodeId
}>()

const imageEl = useTemplateRef<HTMLImageElement>('imageEl')
const containerEl = useTemplateRef<HTMLDivElement>('containerEl')

const {
  imageUrl,
  isLoading,

  cropBoxStyle,
  cropImageStyle,
  resizeHandles,

  handleImageLoad,
  handleImageError,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  handleResizeStart,
  handleResizeMove,
  handleResizeEnd
} = useImageCrop(props.nodeId, { imageEl, containerEl })
</script>
