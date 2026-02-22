<script setup lang="ts">
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@/utils/tailwindUtil'

const { widget } = defineProps<{
  widget: Pick<
    SimplifiedWidget<string | number | undefined>,
    'name' | 'label' | 'borderStyle'
  >
  noBorder?: boolean
}>()

const hideLayoutField = useHideLayoutField()
const borderStyle = computed(() =>
  cn(
    'focus-within:ring focus-within:ring-component-node-widget-background-highlighted',
    widget.borderStyle
  )
)
</script>

<template>
  <div
    class="grid grid-cols-subgrid min-w-0 justify-between gap-1 text-node-component-slot-text"
  >
    <div v-if="!hideLayoutField" class="truncate content-center-safe">
      <template v-if="widget.name">
        {{ widget.label || widget.name }}
      </template>
    </div>
    <!-- basis-full grow -->
    <div class="relative min-w-0 flex-1">
      <div
        :class="
          cn(
            'cursor-default min-w-0 rounded-lg transition-all',
            !noBorder && borderStyle
          )
        "
        @pointerdown.stop
        @pointermove.stop
        @pointerup.stop
      >
        <slot :border-style />
      </div>
    </div>
  </div>
</template>
