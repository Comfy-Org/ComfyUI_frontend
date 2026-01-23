<script setup lang="ts">
import { computed } from 'vue'

import type {
  SimplifiedControlWidget,
  SimplifiedWidget
} from '@/types/simplifiedWidget'

import WidgetInputNumberInput from './WidgetInputNumberInput.vue'
import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'
import WidgetWithControl from './WidgetWithControl.vue'

const props = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const modelValue = defineModel<number>({ default: 0 })

const hasControlAfterGenerate = computed(() => {
  return !!props.widget.controlWidget
})
</script>

<template>
  <WidgetWithControl
    v-if="hasControlAfterGenerate"
    v-model="modelValue"
    :widget="widget as SimplifiedControlWidget<number>"
    :component="
      widget.type === 'slider'
        ? WidgetInputNumberSlider
        : WidgetInputNumberInput
    "
  />
  <component
    :is="
      widget.type === 'slider'
        ? WidgetInputNumberSlider
        : WidgetInputNumberInput
    "
    v-else
    v-model="modelValue"
    :widget="widget"
    v-bind="$attrs"
  />
</template>
