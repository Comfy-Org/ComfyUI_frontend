<template>
  <div class="flex flex-col gap-1">
    <Select
      :model-value="modelValue.interpolation"
      @update:model-value="onInterpolationChange"
    >
      <SelectTrigger size="md">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="interp in CURVE_INTERPOLATIONS"
          :key="interp"
          :value="interp"
        >
          {{ $t(`curveWidget.${interp}`) }}
        </SelectItem>
      </SelectContent>
    </Select>
    <CurveEditor
      :model-value="modelValue.points"
      :interpolation="modelValue.interpolation"
      @update:model-value="onPointsChange"
    />
  </div>
</template>

<script setup lang="ts">
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'

import CurveEditor from './CurveEditor.vue'
import { CURVE_INTERPOLATIONS } from './types'
import type { CurveData, CurveInterpolation, CurvePoint } from './types'

const modelValue = defineModel<CurveData>({
  default: () => ({
    points: [
      [0, 0],
      [1, 1]
    ],
    interpolation: 'monotone_cubic'
  })
})

function onPointsChange(points: CurvePoint[]) {
  modelValue.value = { ...modelValue.value, points }
}

function onInterpolationChange(value: unknown) {
  if (typeof value !== 'string') return
  modelValue.value = {
    ...modelValue.value,
    interpolation: value as CurveInterpolation
  }
}
</script>
