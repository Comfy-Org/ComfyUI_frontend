<template>
  <div
    class="widget-expands relative flex h-full w-full flex-col gap-1"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <!-- Number inputs row -->
    <div class="flex shrink-0 gap-1 px-1">
      <div class="flex flex-1 items-center gap-1">
        <label class="w-6 text-xs text-muted">X</label>
        <input
          v-model.number="cropX"
          type="number"
          :min="0"
          class="h-6 w-full rounded border border-border bg-input px-1 text-xs"
          @change="handleInputChange"
        />
      </div>
      <div class="flex flex-1 items-center gap-1">
        <label class="w-6 text-xs text-muted">Y</label>
        <input
          v-model.number="cropY"
          type="number"
          :min="0"
          class="h-6 w-full rounded border border-border bg-input px-1 text-xs"
          @change="handleInputChange"
        />
      </div>
      <div class="flex flex-1 items-center gap-1">
        <label class="w-6 text-xs text-muted">W</label>
        <input
          v-model.number="cropWidth"
          type="number"
          :min="1"
          class="h-6 w-full rounded border border-border bg-input px-1 text-xs"
          @change="handleInputChange"
        />
      </div>
      <div class="flex flex-1 items-center gap-1">
        <label class="w-6 text-xs text-muted">H</label>
        <input
          v-model.number="cropHeight"
          type="number"
          :min="1"
          class="h-6 w-full rounded border border-border bg-input px-1 text-xs"
          @change="handleInputChange"
        />
      </div>
    </div>

    <!-- Image preview container -->
    <div
      ref="containerEl"
      class="relative min-h-0 flex-1 overflow-hidden rounded-[5px] bg-node-component-surface"
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

export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
}

const props = defineProps<{
  nodeId: NodeId
}>()

const modelValue = defineModel<CropRegion>({
  default: () => ({ x: 0, y: 0, width: 512, height: 512 })
})

const imageEl = useTemplateRef<HTMLImageElement>('imageEl')
const containerEl = useTemplateRef<HTMLDivElement>('containerEl')

const {
  imageUrl,
  isLoading,

  cropX,
  cropY,
  cropWidth,
  cropHeight,

  cropBoxStyle,
  cropImageStyle,
  resizeHandles,

  handleImageLoad,
  handleImageError,
  handleInputChange,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  handleResizeStart,
  handleResizeMove,
  handleResizeEnd
} = useImageCrop(props.nodeId, { imageEl, containerEl, modelValue })
</script>
