<template>
  <div
    class="flex size-full items-center gap-2"
    data-testid="colors"
    @pointerdown.stop
  >
    <span
      v-if="widget?.name"
      class="shrink-0 truncate text-node-component-slot-text"
    >
      {{ widget.label || widget.name }}
    </span>
    <PaletteSwatchRow v-model="modelValue" :max="MAX_COLORS" />
  </div>
</template>

<script setup lang="ts">
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import PaletteSwatchRow from './PaletteSwatchRow.vue'

const MAX_COLORS = 16

const { widget } = defineProps<{
  widget?: Pick<SimplifiedWidget<string[]>, 'name' | 'label'>
}>()

const modelValue = defineModel<string[]>({ default: () => [] })
</script>
