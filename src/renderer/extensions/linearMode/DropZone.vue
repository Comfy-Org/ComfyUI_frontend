<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  onDragOver?: (e: DragEvent) => boolean
  onDragDrop?: (e: DragEvent) => Promise<boolean> | boolean
  dropIndicator?: {
    iconClass?: string
    imageUrl?: string
    label?: string
    onClick?: (e: MouseEvent) => void
  }
}>()

const dropZoneRef = ref<HTMLElement | null>(null)
const canAcceptDrop = ref(false)

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (_files, event) => {
    // Stop propagation to prevent global handlers from creating a new node
    event?.stopPropagation()

    if (props.onDragDrop && event) {
      props.onDragDrop(event)
    }
    canAcceptDrop.value = false
  },
  onOver: (_, event) => {
    if (props.onDragOver && event) {
      canAcceptDrop.value = props.onDragOver(event)
    }
  },
  onLeave: () => {
    canAcceptDrop.value = false
  }
})
</script>
<template>
  <div
    v-if="onDragOver && onDragDrop"
    ref="dropZoneRef"
    :class="
      cn(
        'rounded-lg ring-primary-500 ring-inset',
        canAcceptDrop && isOverDropZone && 'bg-primary-500/10 ring-4'
      )
    "
  >
    <slot />
    <div
      v-if="dropIndicator"
      :class="
        cn(
          'm-3 flex h-25 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle py-2',
          dropIndicator?.onClick && 'cursor-pointer'
        )
      "
      @click.prevent="dropIndicator?.onClick?.($event)"
    >
      <img
        v-if="dropIndicator?.imageUrl"
        class="h-23"
        :src="dropIndicator?.imageUrl"
      />
      <template v-else>
        <span v-if="dropIndicator.label" v-text="dropIndicator.label" />
        <i v-if="dropIndicator.iconClass" :class="dropIndicator.iconClass" />
      </template>
    </div>
  </div>
  <slot v-else />
</template>
