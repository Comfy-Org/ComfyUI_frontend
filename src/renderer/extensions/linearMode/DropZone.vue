<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

defineProps<{
  onDragOver?: (e: DragEvent) => boolean
  onDragDrop?: (e: DragEvent) => Promise<boolean> | boolean
  dropIndicator?: {
    iconClass?: string
    imageUrl?: string
    label?: string
    onClick?: (e: MouseEvent) => void
  }
}>()

const canAcceptDrop = ref(false)
</script>
<template>
  <div
    v-if="onDragOver && onDragDrop"
    :class="
      cn(
        'rounded-lg ring-primary-500 ring-inset',
        canAcceptDrop && 'bg-primary-500/10 ring-4'
      )
    "
    @dragover.prevent="canAcceptDrop = onDragOver?.($event)"
    @dragleave="canAcceptDrop = false"
    @drop.stop.prevent="
      (e: DragEvent) => {
        onDragDrop!(e)
        canAcceptDrop = false
      }
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
      >
      <template v-else>
        <span
          v-if="dropIndicator.label"
          v-text="dropIndicator.label"
        />
        <i
          v-if="dropIndicator.iconClass"
          :class="dropIndicator.iconClass"
        />
      </template>
    </div>
  </div>
  <slot v-else />
</template>
