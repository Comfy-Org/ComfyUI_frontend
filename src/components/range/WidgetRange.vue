<template>
  <RangeEditor
    :model-value="effectiveValue"
    :display="widget?.options?.display"
    :gradient-stops="widget?.options?.gradient_stops"
    :show-midpoint="widget?.options?.show_midpoint"
    :midpoint-scale="widget?.options?.midpoint_scale"
    :histogram="histogram"
    :disabled="isDisabled"
    :value-min="widget?.options?.value_min"
    :value-max="widget?.options?.value_max"
    @update:model-value="onValueChange"
    @edit-end="commitAfterUpdate"
  >
    <template #actions>
      <WidgetHistoryButtons :can-undo :can-redo @undo="undo" @redo="redo" />
    </template>
  </RangeEditor>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'

import {
  singleValueExtractor,
  useUpstreamValue
} from '@/composables/useUpstreamValue'
import { useWidgetValueHistory } from '@/composables/useWidgetValueHistory'
import { widgetHistoryScope } from '@/composables/widgetHistoryScope'
import WidgetHistoryButtons from '@/components/widgetHistory/WidgetHistoryButtons.vue'
import type {
  IWidgetRangeOptions,
  RangeValue
} from '@/lib/litegraph/src/types/widgets'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import RangeEditor from './RangeEditor.vue'
import { isRangeValue } from './rangeUtils'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<RangeValue, IWidgetRangeOptions>
  nodeId?: NodeId
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

const { canUndo, canRedo, undo, redo, commit, discardHistory } =
  useWidgetValueHistory({
    scope: () => widgetHistoryScope(widget, nodeId),
    read: () => modelValue.value,
    apply: (value) => {
      if (isRangeValue(value)) modelValue.value = value
    }
  })

function commitAfterUpdate(mergeKey?: string) {
  void nextTick(() => commit(mergeKey))
}

watch(upstreamValue, (upstream) => {
  if (isDisabled.value && upstream) {
    modelValue.value = upstream
    void nextTick(discardHistory)
  }
})

const effectiveValue = computed(() =>
  isDisabled.value && upstreamValue.value
    ? upstreamValue.value
    : modelValue.value
)

function onValueChange(value: RangeValue) {
  modelValue.value = value
}
</script>
