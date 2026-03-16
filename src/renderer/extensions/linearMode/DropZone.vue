<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { computed, ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

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
  }
  forceHovered?: boolean
}>()

const dropZoneRef = ref<HTMLElement | null>(null)
const canAcceptDrop = ref(false)

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
          'm-3 block w-[calc(100%-1.5rem)] appearance-none overflow-hidden rounded-lg border border-node-component-border bg-transparent p-1 text-left text-component-node-foreground-secondary transition-colors',
          dropIndicator?.onClick && 'cursor-pointer'
        )
      "
      @click.prevent="dropIndicator?.onClick?.($event)"
    >
      <div
        :class="
          cn(
            'flex min-h-23 w-full flex-col items-center justify-center gap-2 rounded-[7px] p-6 text-center text-sm/tight transition-colors',
            isHovered &&
              !dropIndicator?.imageUrl &&
              'border border-dashed border-component-node-foreground-secondary bg-component-node-widget-background-hovered'
          )
        "
      >
        <img
          v-if="dropIndicator?.imageUrl"
          class="max-h-23 rounded-md object-contain"
          :alt="dropIndicator?.label ?? ''"
          :src="dropIndicator?.imageUrl"
        />
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
