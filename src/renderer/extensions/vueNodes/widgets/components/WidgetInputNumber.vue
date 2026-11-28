<script setup lang="ts">
import { computed } from 'vue'

import {
  widgetControl,
  widgetType
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import WidgetInputNumberGradientSlider from './WidgetInputNumberGradientSlider.vue'
import WidgetInputNumberInput from './WidgetInputNumberInput.vue'
import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'
import WidgetWithControl from './WidgetWithControl.vue'

const { widgetId, displayLabel } = defineProps<{
  widgetId: WidgetId
  displayLabel?: string
}>()

const modelValue = defineModel<number>({ default: 0 })

const widgetComponent = computed(() => {
  switch (widgetType(widgetId)) {
    case 'gradientslider':
      return WidgetInputNumberGradientSlider
    case 'slider':
      return WidgetInputNumberSlider
    default:
      return WidgetInputNumberInput
  }
})
</script>

<template>
  <WidgetWithControl
    v-if="widgetControl(widgetId)"
    v-model="modelValue"
    :widget-id
    :display-label
    :component="widgetComponent"
  />
  <component
    :is="widgetComponent"
    v-else
    v-model="modelValue"
    :widget-id
    :display-label
    v-bind="$attrs"
  />
</template>
