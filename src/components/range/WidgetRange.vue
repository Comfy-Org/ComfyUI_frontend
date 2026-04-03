<template>
  <RangeEditor
    :model-value="effectiveValue.value"
    :display="widget?.options?.display"
    :gradient-stops="widget?.options?.gradient_stops"
    :show-midpoint="widget?.options?.show_midpoint"
    :midpoint-scale="widget?.options?.midpoint_scale"
    :histogram="histogram"
    :disabled="isDisabled"
    :value-min="widget?.options?.value_min"
    :value-max="widget?.options?.value_max"
    @update:model-value="onValueChange"
  />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

import {
  singleValueExtractor,
  useUpstreamValue
} from '@/composables/useUpstreamValue'
import type {
  IWidgetRangeOptions,
  RangeValue
} from '@/lib/litegraph/src/types/widgets'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import RangeEditor from './RangeEditor.vue'
import { isRangeValue } from './rangeUtils'

const { widget } = defineProps<{
  widget: SimplifiedWidget<RangeValue, IWidgetRangeOptions>
}>()

const modelValue = defineModel<RangeValue>({
  default: () => ({ min: 0, max: 1 })
})

const isDisabled = computed(() => !!widget.options?.disabled)

const nodeOutputStore = useNodeOutputStore()
const histogram = computed(() => {
  const locatorId = widget.nodeLocatorId
  if (!locatorId) return null
  const output = nodeOutputStore.nodeOutputs[locatorId]
  const key = `histogram_${widget.name}`
  const data = (output as Record<string, unknown>)?.[key]
  if (!Array.isArray(data) || data.length === 0) return null
  return new Uint32Array(data)
})

const upstreamValue = useUpstreamValue(
  () => widget.linkedUpstream,
  singleValueExtractor(isRangeValue)
)

watch(upstreamValue, (upstream) => {
  if (isDisabled.value && upstream) {
    modelValue.value = upstream
  }
})

const effectiveValue = computed(() =>
  isDisabled.value && upstreamValue.value
    ? { value: upstreamValue.value }
    : { value: modelValue.value }
)

function onValueChange(value: RangeValue) {
  modelValue.value = value
}
</script>
