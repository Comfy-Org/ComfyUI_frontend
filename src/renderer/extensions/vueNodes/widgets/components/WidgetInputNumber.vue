<script setup lang="ts">
import { computed } from 'vue'

import { useWidgetView } from '@/renderer/extensions/vueNodes/widgets/useWidgetView'
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

const widget = useWidgetView(() => widgetId)

const widgetComponent = computed(() => {
  switch (widget.value.type) {
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
    v-if="widget.controlWidget"
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
