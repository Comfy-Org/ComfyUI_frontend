<template>
  <RangeEditor
    :model-value="effectiveValue"
    :display="rangeOptions.display"
    :gradient-stops="rangeOptions.gradient_stops"
    :show-midpoint="rangeOptions.show_midpoint"
    :midpoint-scale="rangeOptions.midpoint_scale"
    :histogram="histogram"
    :disabled="isDisabled"
    :value-min="rangeOptions.value_min"
    :value-max="rangeOptions.value_max"
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
} from '@comfyorg/graph-model/widgets'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import {
  widgetLinkedUpstream,
  widgetName,
  widgetNodeLocatorId,
  widgetOptions
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'

import RangeEditor from './RangeEditor.vue'
import { isRangeValue } from './rangeUtils'

const { widgetId, nodeId } = defineProps<{
  widgetId: WidgetId
  nodeId?: NodeId
}>()

const rangeOptions = computed<IWidgetRangeOptions>(() =>
  widgetOptions(widgetId)
)

const modelValue = defineModel<RangeValue>({
  default: () => ({ min: 0, max: 1 })
})

const isDisabled = computed(() => !!rangeOptions.value.disabled)

const nodeOutputStore = useNodeOutputStore()
const histogram = computed(() => {
  const locatorId = widgetNodeLocatorId(widgetId)
  if (!locatorId) return null
  const output = nodeOutputStore.nodeOutputs[locatorId]
  const key = `histogram_${widgetName(widgetId)}`
  const data = (output as Record<string, unknown>)?.[key]
  if (!Array.isArray(data) || data.length === 0) return null
  return new Uint32Array(data)
})

const upstreamValue = useUpstreamValue(
  () => widgetLinkedUpstream(widgetId),
  singleValueExtractor(isRangeValue)
)

const { canUndo, canRedo, undo, redo, commit, discardHistory } =
  useWidgetValueHistory({
    scope: () => widgetHistoryScope(widgetId, nodeId),
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
