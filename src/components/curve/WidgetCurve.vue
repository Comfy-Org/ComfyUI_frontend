<template>
  <div class="flex flex-col gap-1">
    <Select
      v-if="!isDisabled"
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
      :model-value="effectiveCurve.points"
      :disabled="isDisabled"
      :interpolation="effectiveCurve.interpolation"
      @update:model-value="onPointsChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import {
  singleValueExtractor,
  useUpstreamValue
} from '@/composables/useUpstreamValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'

import CurveEditor from './CurveEditor.vue'
import { isCurveData } from './curveUtils'
import { CURVE_INTERPOLATIONS } from './types'
import type { CurveData, CurveInterpolation, CurvePoint } from './types'

const { widget } = defineProps<{
  widget: SimplifiedWidget
}>()

const modelValue = defineModel<CurveData>({
  default: () => ({
    points: [
      [0, 0],
      [1, 1]
    ],
    interpolation: 'monotone_cubic'
  })
})

const isDisabled = computed(() => !!widget.options?.disabled)

const upstreamValue = useUpstreamValue(
  () => widget.linkedUpstream,
  singleValueExtractor(isCurveData)
)

const effectiveCurve = computed(() =>
  isDisabled.value && upstreamValue.value
    ? upstreamValue.value
    : modelValue.value
)

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
