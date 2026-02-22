<template>
  <div class="widget-expands">
    <CurveEditor v-model="modelValue" />
  </div>
</template>

<script setup lang="ts">
import type { CurvePoint } from '@/lib/litegraph/src/types/widgets'

import CurveEditor from './CurveEditor.vue'

const modelValue = defineModel<CurvePoint[]>({
  default: () => [
    [0, 0],
    [1, 1]
  ]
})
</script>
