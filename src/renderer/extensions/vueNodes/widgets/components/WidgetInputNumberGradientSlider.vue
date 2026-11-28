<template>
  <WidgetLayoutField :widget-id :display-label :input-id fill-width>
    <template #between><slot name="between" /></template>
    <div
      :class="
        cn(
          WidgetInputBaseClass,
          'flex items-center gap-2 pr-2 pl-3 not-disabled:bg-transparent',
          useWidgetHeight()
        )
      "
    >
      <GradientSlider
        v-model="modelValue"
        :stops="gradientStops"
        :min="options.min ?? 0"
        :max="options.max ?? 100"
        :step
        :disabled="options.disabled"
        :aria-label="widgetName(widgetId)"
        class="min-w-0 flex-1"
      />
      <NumberField
        v-model="modelValue"
        :step
        :min="options.min"
        :max="options.max"
        :disabled="options.disabled"
        :format-options="{
          minimumFractionDigits: precision,
          maximumFractionDigits: precision
        }"
        class="h-auto w-auto shrink-0 bg-transparent focus-within:ring-0 hover:bg-transparent"
      >
        <NumberFieldInput
          :id="inputId"
          :aria-label="widgetName(widgetId)"
          class="field-sizing-content w-auto max-w-16 flex-none text-right text-xs"
        />
      </NumberField>
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

import GradientSlider from '@comfyorg/design-system/slider/GradientSlider'
import NumberField from '@comfyorg/design-system/number-field/NumberField'
import NumberFieldInput from '@comfyorg/design-system/number-field/NumberFieldInput'
import type { ColorStop } from '@comfyorg/graph-model/interfaces'
import type {
  IWidgetGradientSliderOptions,
  IWidgetOptions
} from '@comfyorg/graph-model/widgets'
import { useWidgetHeight } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

import { useNumberStepCalculation } from '@/renderer/extensions/vueNodes/widgets/composables/useNumberStepCalculation'
import {
  widgetName,
  widgetOptions
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const DEFAULT_GRADIENT_STOPS: ColorStop[] = [
  { offset: 0, color: [0, 0, 0] },
  { offset: 1, color: [255, 255, 255] }
]

const { widgetId, displayLabel } = defineProps<{
  widgetId: WidgetId
  displayLabel?: string
}>()

const options = computed<
  IWidgetOptions & Pick<IWidgetGradientSliderOptions, 'gradient_stops'>
>(() => widgetOptions(widgetId))

const modelValue = defineModel<number>({ default: 0 })
const inputId = useId()

const gradientStops = computed<ColorStop[]>(() => {
  const stops = options.value.gradient_stops
  if (stops && stops.length >= 2) return stops
  return DEFAULT_GRADIENT_STOPS
})

const precision = computed(() => {
  const p = options.value.precision
  return typeof p === 'number' && p >= 0 ? p : undefined
})

const step = useNumberStepCalculation(options, precision, true)
</script>
