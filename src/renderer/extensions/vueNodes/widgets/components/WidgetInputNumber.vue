<script setup lang="ts">
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumberInput from './WidgetInputNumberInput.vue'
import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'

defineProps<{
  widget: SimplifiedWidget<number>
}>()

const modelValue = defineModel<number>({ default: 0 })
</script>

<template>
  <component
    :is="
      widget.type === 'slider'
        ? WidgetInputNumberSlider
        : WidgetInputNumberInput
    "
    v-model="modelValue"
    :widget="widget"
    v-bind="$attrs"
  />
</template>
