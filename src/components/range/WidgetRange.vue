<template>
  <RangeEditor
    v-model="modelValue"
    :display="widget?.options?.display"
    :gradient-stops="widget?.options?.gradient_stops"
    :show-midpoint="widget?.options?.show_midpoint"
    :midpoint-scale="widget?.options?.midpoint_scale"
    :histogram="widget?.options?.histogram"
    :value-min="widget?.options?.value_min"
    :value-max="widget?.options?.value_max"
  />
</template>

<script setup lang="ts">
import type {
  IWidgetRangeOptions,
  RangeValue
} from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import RangeEditor from './RangeEditor.vue'

defineProps<{
  widget?: SimplifiedWidget<RangeValue, IWidgetRangeOptions>
}>()

const modelValue = defineModel<RangeValue>({
  default: () => ({ min: 0, max: 1 })
})
</script>
