<template>
  <div
    class="widget-expands relative flex size-full flex-col gap-1"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <!-- Image preview container -->
    <div
      ref="containerEl"
      class="relative min-h-0 flex-1 overflow-hidden rounded-[5px] bg-node-component-surface"
    >
      <div
        v-if="!imageUrl"
        class="flex size-full flex-col items-center justify-center text-center"
        data-testid="crop-empty-state"
      >
        <i
          class="mb-2 icon-[lucide--image] size-12"
          data-testid="crop-empty-icon"
        />
        <p class="text-sm">{{ $t('imageCrop.noInputImage') }}</p>
      </div>

      <template v-else>
        <img
          ref="imageEl"
          :src="imageUrl"
          :alt="$t('imageCrop.cropPreviewAlt')"
          draggable="false"
          class="block size-full object-contain select-none"
          @load="handleImageLoad"
          @error="handleImageError"
          @dragstart.prevent
        />

        <div
          v-if="isLoading"
          aria-live="polite"
          class="absolute inset-0 z-10 flex size-full items-center justify-center bg-node-component-surface/90"
        >
          <span class="text-sm">{{ $t('imageCrop.loading') }}</span>
        </div>

        <div
          v-if="!isLoading"
          :class="
            cn(
              'absolute box-content cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]',
              isDisabled && 'pointer-events-none opacity-60'
            )
          "
          :style="cropBoxStyle"
          data-testid="crop-overlay"
          @pointerdown="handleDragStart"
          @pointermove="handleDragMove"
          @pointerup="handleDragEnd"
        />

        <template v-for="handle in resizeHandles" :key="handle.direction">
          <div
            v-show="!isLoading"
            :data-testid="`crop-resize-${handle.direction}`"
            :class="
              cn(
                'absolute',
                handle.class,
                isDisabled && 'pointer-events-none opacity-60'
              )
            "
            :style="handle.style"
            @pointerdown="(e) => handleResizeStart(e, handle.direction)"
            @pointermove="handleResizeMove"
            @pointerup="handleResizeEnd"
          />
        </template>
      </template>
    </div>

    <div v-if="!isDisabled" class="flex shrink-0 items-center gap-2">
      <label class="text-xs text-muted-foreground">
        {{ $t('imageCrop.ratio') }}
      </label>
      <Select v-model="selectedRatio">
        <SelectTrigger class="h-7 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="key in ratioKeys" :key="key" :value="key">
            {{ key === 'custom' ? $t('imageCrop.custom') : key }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Button
        size="icon"
        :variant="isLockEnabled ? 'primary' : 'secondary'"
        class="size-7"
        :aria-label="
          isLockEnabled
            ? $t('imageCrop.unlockRatio')
            : $t('imageCrop.lockRatio')
        "
        @click="isLockEnabled = !isLockEnabled"
      >
        <i
          :class="
            isLockEnabled
              ? 'icon-[lucide--lock] size-3.5'
              : 'icon-[lucide--lock-open] size-3.5'
          "
        />
      </Button>
    </div>

    <WidgetBoundingBox
      v-model="effectiveBounds"
      :disabled="isDisabled"
      class="shrink-0"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import WidgetBoundingBox from '@/components/boundingbox/WidgetBoundingBox.vue'
import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import { ASPECT_RATIOS, useImageCrop } from '@/composables/useImageCrop'
import {
  boundsExtractor,
  useUpstreamValue
} from '@/composables/useUpstreamValue'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { Bounds } from '@/renderer/core/layout/types'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget
  nodeId: NodeId
}>()

const modelValue = defineModel<Bounds>({
  default: () => ({ x: 0, y: 0, width: 512, height: 512 })
})

const isDisabled = computed(() => !!widget.options?.disabled)

const upstreamValue = useUpstreamValue(
  () => widget.linkedUpstream,
  boundsExtractor()
)

const effectiveBounds = computed({
  get: () =>
    isDisabled.value && upstreamValue.value
      ? upstreamValue.value
      : modelValue.value,
  set: (v) => {
    if (!isDisabled.value) modelValue.value = v
  }
})

const imageEl = useTemplateRef<HTMLImageElement>('imageEl')
const containerEl = useTemplateRef<HTMLDivElement>('containerEl')

const ratioKeys = Object.keys(ASPECT_RATIOS)

const {
  imageUrl,
  isLoading,

  selectedRatio,
  isLockEnabled,

  cropBoxStyle,
  resizeHandles,

  handleImageLoad,
  handleImageError,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  handleResizeStart,
  handleResizeMove,
  handleResizeEnd
} = useImageCrop(nodeId, { imageEl, containerEl, modelValue: effectiveBounds })
</script>
