<script setup lang="ts">
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumberInput from './WidgetInputNumberInput.vue'
import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'
import WidgetInputNumberWithControl from './WidgetInputNumberWithControl.vue'

const props = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const modelValue = defineModel<number>({ default: 0 })

const hasControlAfterGenerate = computed(() => {
  return props.widget.spec?.control_after_generate === true
})
</script>

<template>
  <component
    :is="
      hasControlAfterGenerate
        ? WidgetInputNumberWithControl
        : widget.type === 'slider'
          ? WidgetInputNumberSlider
          : WidgetInputNumberInput
    "
    v-model="modelValue"
    :widget="widget"
    v-bind="$attrs"
  />
</template>
