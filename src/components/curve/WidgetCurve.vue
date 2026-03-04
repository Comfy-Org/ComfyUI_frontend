<template>
  <CurveEditor
    :model-value="effectivePoints"
    :disabled="isDisabled"
    @update:model-value="modelValue = $event"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useLinkedWidgetValue } from '@/composables/useLinkedWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import CurveEditor from './CurveEditor.vue'
import type { CurvePoint } from './types'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget
  nodeId: string
}>()

const modelValue = defineModel<CurvePoint[]>({
  default: () => [
    [0, 0],
    [1, 1]
  ]
})

const isDisabled = computed(() => !!widget.options?.disabled)

const upstreamValue = useLinkedWidgetValue(nodeId, widget.name, 'curve')

const effectivePoints = computed(() =>
  isDisabled.value && upstreamValue.value
    ? (upstreamValue.value as CurvePoint[])
    : modelValue.value
)
</script>
