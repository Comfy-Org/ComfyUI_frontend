<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useDropZone } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useClickDragGuard } from '@/composables/useClickDragGuard'

import DropZoneIndicatorContent from './DropZoneIndicatorContent.vue'
import DropZoneMediaActions from './DropZoneMediaActions.vue'

defineOptions({ inheritAttrs: false })

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
    mediaUrl?: string
    mediaType?: 'image' | 'video' | 'audio'
    label?: string
    onClick?: (e: MouseEvent) => void
    onMaskEdit?: () => void
  }
  forceHovered?: boolean
}>()

const mediaType = computed(() => dropIndicator?.mediaType ?? 'image')
// Video's native controls and AudioPreviewPlayer's buttons are invalid
// markup nested inside a <button> — render a <div> instead once one is shown.
const hasPlayableMedia = computed(
  () => mediaType.value !== 'image' && !!dropIndicator?.mediaUrl
)

const dropZoneRef = ref<HTMLElement | null>(null)
const canAcceptDrop = ref(false)
const clickGuard = useClickDragGuard(5)

function onPointerDown(e: PointerEvent) {
  clickGuard.recordStart(e)
}

function onIndicatorClick(e: MouseEvent) {
  const dragged = e.detail !== 0 && clickGuard.wasDragged(e)
  clickGuard.reset()
  if (dragged) return
  dropIndicator?.onClick?.(e)
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (_files, event) => {
    // Stop propagation to prevent global handlers from creating a new node
    event.stopPropagation()

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
const indicatorTag = computed(() =>
  dropIndicator?.onClick && !hasPlayableMedia.value ? 'button' : 'div'
)
</script>
<template>
  <div
    v-if="onDragOver && onDragDrop"
    ref="dropZoneRef"
    v-bind="$attrs"
    data-slot="drop-zone"
    :class="
      cn(
        'rounded-lg transition-colors',
        isHovered && 'bg-component-node-widget-background-hovered'
      )
    "
  >
    <slot />
    <div v-if="dropIndicator" class="group/dropzone relative">
      <component
        :is="indicatorTag"
        :type="indicatorTag === 'button' ? 'button' : undefined"
        :aria-label="
          indicatorTag === 'button' ? dropIndicator.label : undefined
        "
        data-slot="drop-zone-indicator"
        data-testid="drop-zone-indicator"
        :class="
          cn(
            'm-3 block h-25 resize-y appearance-none overflow-hidden rounded-lg border border-node-component-border bg-transparent p-1 text-left text-component-node-foreground-secondary transition-colors',
            indicatorTag === 'button' && 'cursor-pointer'
          )
        "
        @pointerdown="onPointerDown"
        @click.prevent="onIndicatorClick"
      >
        <DropZoneIndicatorContent
          :media-type="mediaType"
          :media-url="dropIndicator.mediaUrl"
          :label="dropIndicator.label"
          :icon-class="dropIndicator.iconClass"
          :is-hovered="isHovered"
        />
      </component>
      <DropZoneMediaActions
        v-if="mediaType === 'image' && dropIndicator.mediaUrl"
        :media-url="dropIndicator.mediaUrl"
        :label="dropIndicator.label"
        :on-mask-edit="dropIndicator.onMaskEdit"
      />
    </div>
  </div>
  <slot v-else />
</template>
