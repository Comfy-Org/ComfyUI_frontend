<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

defineProps<{
  onDragOver?: (e: DragEvent) => boolean
  onDragDrop?: (e: DragEvent) => Promise<boolean> | boolean
  dropIndicator?: { label?: string; iconClass?: string }
}>()

const canAcceptDrop = ref(false)
</script>
<template>
  <drop-wrapper
    v-if="onDragOver && onDragDrop"
    :class="
      cn(
        'rounded-lg ring-inset ring-primary-500',
        canAcceptDrop && 'ring-4 bg-primary-500/10'
      )
    "
    @dragover.prevent="(e: DragEvent) => (canAcceptDrop = onDragOver!(e))"
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
      class="flex flex-col items-center align-center border-dashed rounded-lg border grow-1 w-full border-border-subtle my-3 py-2"
    >
      <span v-if="dropIndicator.label" v-text="dropIndicator.label" />
      <i v-if="dropIndicator.iconClass" :class="dropIndicator.iconClass" />
    </div>
  </drop-wrapper>
  <slot v-else />
</template>
