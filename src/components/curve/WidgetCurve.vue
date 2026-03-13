<template>
  <CurveEditor
    :model-value="effectivePoints"
    :disabled="isDisabled"
    @update:model-value="modelValue = $event"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import {
  singleValueExtractor,
  useUpstreamValue
} from '@/composables/useUpstreamValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import CurveEditor from './CurveEditor.vue'
import { isCurvePointArray } from './curveUtils'
import type { CurvePoint } from './types'

const { widget } = defineProps<{
  widget: SimplifiedWidget
}>()

const modelValue = defineModel<CurvePoint[]>({
  default: () => [
    [0, 0],
    [1, 1]
  ]
})

const isDisabled = computed(() => !!widget.options?.disabled)

const upstreamValue = useUpstreamValue(
  () => widget.linkedUpstream,
  singleValueExtractor(isCurvePointArray)
)

const effectivePoints = computed(() =>
  isDisabled.value && upstreamValue.value
    ? (upstreamValue.value as CurvePoint[])
    : modelValue.value
)
</script>
