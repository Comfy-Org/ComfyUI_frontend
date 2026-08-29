<template>
  <WidgetLayoutField :widget="widget">
    <div :class="cn(WidgetInputBaseClass, 'flex items-center gap-2 pr-2 pl-3')">
      <GradientSlider
        v-model="modelValue"
        :stops="gradientStops"
        :min="widget.options?.min ?? 0"
        :max="widget.options?.max ?? 100"
        :step="stepValue"
        :disabled="widget.options?.disabled"
        :aria-label="widget.name"
        class="min-w-0 flex-1"
      />
      <FormattedNumberStepper
        v-model="modelValue"
        :step="stepValue"
        :min="widget.options?.min ?? -Infinity"
        :max="widget.options?.max"
        :disabled="widget.options?.disabled"
        :format-options="{
          minimumFractionDigits: precision,
          maximumFractionDigits: precision
        }"
        :aria-label="widget.name"
        class="w-16 shrink-0"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import GradientSlider from '@/components/gradientslider/GradientSlider.vue'
import FormattedNumberStepper from '@/components/ui/stepper/FormattedNumberStepper.vue'
import type { ColorStop } from '@/lib/litegraph/src/interfaces'
import type { IWidgetGradientSliderOptions } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'

import { useNumberStepCalculation } from '../composables/useNumberStepCalculation'
import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const DEFAULT_GRADIENT_STOPS: ColorStop[] = [
  { offset: 0, color: [0, 0, 0] },
  { offset: 1, color: [255, 255, 255] }
]

const { widget } = defineProps<{
  widget: SimplifiedWidget<number, IWidgetGradientSliderOptions>
}>()

const modelValue = defineModel<number>({ default: 0 })

const gradientStops = computed<ColorStop[]>(() => {
  const stops = widget.options?.gradient_stops
  if (stops && stops.length >= 2) return stops
  return DEFAULT_GRADIENT_STOPS
})

const precision = computed(() => {
  const p = widget.options?.precision
  return typeof p === 'number' && p >= 0 ? p : undefined
})

const stepValue = useNumberStepCalculation(widget.options, precision, true)
</script>
