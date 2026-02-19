<script setup lang="ts">
import { computed } from 'vue'

import type {
  SimplifiedControlWidget,
  SimplifiedWidget
} from '@/types/simplifiedWidget'

import WidgetInputNumberGradientSlider from './WidgetInputNumberGradientSlider.vue'
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

const widgetComponent = computed(() => {
  if (props.widget.type === 'gradientslider')
    return WidgetInputNumberGradientSlider
  if (props.widget.type === 'slider') return WidgetInputNumberSlider
  return WidgetInputNumberInput
})
</script>

<template>
  <WidgetWithControl
    v-if="hasControlAfterGenerate"
    v-model="modelValue"
    :widget="widget as SimplifiedControlWidget<number>"
    :component="widgetComponent"
  />
  <component
    :is="widgetComponent"
    v-else
    v-model="modelValue"
    :widget="widget"
    v-bind="$attrs"
  />
</template>
