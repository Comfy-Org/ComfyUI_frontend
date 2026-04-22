<script setup lang="ts">
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@/utils/tailwindUtil'

const { widget, rootClass } = defineProps<{
  widget: Pick<
    SimplifiedWidget<string | number | undefined>,
    'name' | 'label' | 'borderStyle'
  >
  rootClass?: string
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
    :class="
      cn(
        'grid min-w-0 grid-cols-subgrid justify-between gap-1 text-node-component-slot-text',
        rootClass
      )
    "
  >
    <div
      v-if="!hideLayoutField"
      data-testid="widget-layout-field-label"
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
            'min-w-0 cursor-default rounded-lg transition-all',
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
