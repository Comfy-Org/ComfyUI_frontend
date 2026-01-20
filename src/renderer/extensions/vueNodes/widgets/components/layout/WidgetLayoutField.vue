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
    class="grid min-w-0 grid-cols-subgrid justify-between gap-1 text-node-component-slot-text"
  >
    <div
      v-if="!hideLayoutField"
      class="content-center-safe truncate"
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
            'min-w-0 cursor-default rounded-lg transition-all focus-within:ring focus-within:ring-component-node-widget-background-highlighted',
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
