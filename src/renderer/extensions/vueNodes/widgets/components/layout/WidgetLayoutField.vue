<script setup lang="ts">
import { inject } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  widget: Pick<
    SimplifiedWidget<string | number | undefined>,
    'name' | 'label' | 'borderStyle'
  >
}>()

const hideLayoutField = inject<boolean>('hideLayoutField', false)
</script>

<template>
  <div
    class="grid grid-cols-subgrid min-w-0 items-center justify-between gap-1"
  >
    <div
      v-if="!hideLayoutField"
      class="relative flex h-full min-w-0 items-center"
    >
      <p
        v-if="widget.name"
        class="flex-1 truncate text-xs font-normal text-node-component-slot-text my-0"
      >
        {{ widget.label || widget.name }}
      </p>
    </div>
    <!-- basis-full grow -->
    <div class="relative min-w-0 flex-1">
      <div
        :class="
          cn(
            'cursor-default min-w-0 rounded-lg space-y-1 focus-within:ring focus-within:ring-component-node-widget-background-highlighted transition-all',
            widget.borderStyle
          )
        "
        @pointerdown.stop
        @pointermove.stop
        @pointerup.stop
      >
        <slot />
      </div>
    </div>
  </div>
</template>
