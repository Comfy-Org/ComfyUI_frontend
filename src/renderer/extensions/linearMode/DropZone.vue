<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const {
  onDragOver,
  onDragDrop,
  dropIndicator,
  forceHovered = false
} = defineProps<{
  onDragOver?: (e: DragEvent) => boolean
  onDragDrop?: (e: DragEvent) => Promise<boolean> | boolean
  dropIndicator?: {
    iconClass?: string
    imageUrl?: string
    label?: string
    onClick?: (e: MouseEvent) => void
    onMaskEdit?: () => void
  }
  forceHovered?: boolean
}>()

const dropZoneRef = ref<HTMLElement | null>(null)
const canAcceptDrop = ref(false)
const pointerStart = ref<{ x: number; y: number } | null>(null)

function onPointerDown(e: PointerEvent) {
  pointerStart.value = { x: e.clientX, y: e.clientY }
}

function onIndicatorClick(e: MouseEvent) {
  if (e.detail !== 0) {
    const start = pointerStart.value
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (dx * dx + dy * dy > 25) {
        pointerStart.value = null
        return
      }
    }
  }
  pointerStart.value = null
  dropIndicator?.onClick?.(e)
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (_files, event) => {
    // Stop propagation to prevent global handlers from creating a new node
    event?.stopPropagation()

    if (onDragDrop && event) {
      onDragDrop(event)
    }
    canAcceptDrop.value = false
  },
  onOver: (_, event) => {
    if (onDragOver && event) {
      canAcceptDrop.value = onDragOver(event)
    }
  },
  onLeave: () => {
    canAcceptDrop.value = false
  }
})

const isHovered = computed(
  () => forceHovered || (canAcceptDrop.value && isOverDropZone.value)
)
const indicatorTag = computed(() => (dropIndicator?.onClick ? 'button' : 'div'))
</script>
<template>
  <div
    v-if="onDragOver && onDragDrop"
    ref="dropZoneRef"
    data-slot="drop-zone"
    :class="
      cn(
        'rounded-lg transition-colors',
        isHovered && 'bg-component-node-widget-background-hovered'
      )
    "
  >
    <slot />
    <component
      :is="indicatorTag"
      v-if="dropIndicator"
      :type="dropIndicator?.onClick ? 'button' : undefined"
      :aria-label="dropIndicator?.onClick ? dropIndicator.label : undefined"
      data-slot="drop-zone-indicator"
      :class="
        cn(
          'group/dropzone m-3 block h-42 min-h-32 w-[calc(100%-1.5rem)] resize-y appearance-none overflow-hidden rounded-lg border border-node-component-border bg-transparent p-1 text-left text-component-node-foreground-secondary transition-colors',
          dropIndicator?.onClick && 'cursor-pointer'
        )
      "
      @pointerdown="onPointerDown"
      @click.prevent="onIndicatorClick"
    >
      <div
        :class="
          cn(
            'flex h-full max-w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[7px] p-3 text-center text-sm/tight transition-colors',
            isHovered &&
              !dropIndicator?.imageUrl &&
              'border border-dashed border-component-node-foreground-secondary bg-component-node-widget-background-hovered'
          )
        "
      >
        <div
          v-if="dropIndicator?.imageUrl"
          class="relative max-h-full max-w-full"
        >
          <img
            class="max-h-full max-w-full rounded-md object-contain"
            :alt="dropIndicator?.label ?? ''"
            :src="dropIndicator?.imageUrl"
          />
          <button
            v-if="dropIndicator?.onMaskEdit"
            type="button"
            :aria-label="t('maskEditor.openMaskEditor')"
            :title="t('maskEditor.openMaskEditor')"
            class="absolute top-2 right-2 flex cursor-pointer items-center justify-center rounded-lg bg-base-foreground p-2 text-base-background opacity-0 transition-colors duration-200 group-hover/dropzone:opacity-100 hover:bg-base-foreground/90"
            @click.stop="dropIndicator?.onMaskEdit?.()"
          >
            <i class="icon-[comfy--mask] size-4" />
          </button>
        </div>
        <template v-else>
          <span v-if="dropIndicator.label" v-text="dropIndicator.label" />
          <i
            v-if="dropIndicator.iconClass"
            :class="
              cn(
                'size-4 text-component-node-foreground-secondary',
                dropIndicator.iconClass
              )
            "
          />
        </template>
      </div>
    </component>
  </div>
  <slot v-else />
</template>
