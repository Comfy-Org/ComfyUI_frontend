<template>
  <CurveEditor v-model="modelValue" />
</template>

<script setup lang="ts">
import type { CurvePoint } from './types'

import CurveEditor from './CurveEditor.vue'

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
    ? upstreamValue.value
    : modelValue.value
)
</script>
