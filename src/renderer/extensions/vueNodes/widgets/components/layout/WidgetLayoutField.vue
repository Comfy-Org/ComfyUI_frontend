<script setup lang="ts">
import { inject } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  widget: Pick<
    SimplifiedWidget<string | number | undefined>,
    'name' | 'label' | 'borderStyle'
  > & {
    labelStyle?: string
  }
}>()

const hideLayoutField = inject<boolean>('hideLayoutField', false)
</script>

<template>
  <div
    class="grid grid-cols-subgrid min-w-0 justify-between gap-1 text-node-component-slot-text"
  >
    <div
      v-if="!hideLayoutField"
      :class="cn('truncate content-center-safe', widget.labelStyle)"
    >
      <template v-if="widget.name">
        {{ widget.label || widget.name }}
      </template>
    </div>
    <!-- basis-full grow -->
    <div class="relative min-w-0 flex-1">
      <div
        :class="
          cn(
            'cursor-default min-w-0 rounded-lg focus-within:ring focus-within:ring-component-node-widget-background-highlighted transition-all',
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
