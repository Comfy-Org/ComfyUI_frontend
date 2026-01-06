<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

defineProps<{
  onDragOver?: (e: DragEvent) => boolean
  onDragDrop?: (e: DragEvent) => Promise<boolean> | boolean
  dropIndicator?: {
    label?: string
    iconClass?: string
    onClick?: (e: MouseEvent) => void
  }
}>()

const canAcceptDrop = ref(false)
</script>
<template>
  <drop-wrapper v-if="onDragOver && onDragDrop">
    <div
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
      <!--Slot is wrapped to ensure it's last and doesn't have border-->
      <div><slot /></div>
      <div
        v-if="dropIndicator"
        :class="
          cn(
            'flex flex-col items-center justify-center gap-2 border-dashed rounded-lg border h-25 w-full border-border-subtle my-3 py-2',
            dropIndicator?.onClick && 'cursor-pointer'
          )
        "
        @click.prevent="(e: MouseEvent) => dropIndicator!.onClick?.(e)"
      >
        <span v-if="dropIndicator.label" v-text="dropIndicator.label" />
        <i v-if="dropIndicator.iconClass" :class="dropIndicator.iconClass" />
      </div>
    </div>
  </drop-wrapper>
  <slot v-else />
</template>
