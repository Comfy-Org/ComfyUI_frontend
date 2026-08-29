<template>
  <WidgetLayoutField :widget="widget">
    <div
      :class="
        cn(
          WidgetInputBaseClass,
          'flex items-center gap-2 pr-2 pl-3 not-disabled:hover:bg-component-node-widget-background-hovered'
        )
      "
    >
      <Slider
        :model-value="[modelValue]"
        v-bind="filteredProps"
        class="grow text-xs"
        :step="stepValue"
        :aria-label="widget.name"
        @update:model-value="updateLocalValue"
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
        class="w-16"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Slider from '@/components/ui/slider/Slider.vue'
import FormattedNumberStepper from '@/components/ui/stepper/FormattedNumberStepper.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { useNumberStepCalculation } from '../composables/useNumberStepCalculation'
import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { widget } = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const modelValue = defineModel<number>({ default: 0 })

const updateLocalValue = (newValue: number[] | undefined): void => {
  if (newValue?.length) modelValue.value = newValue[0]
}

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, STANDARD_EXCLUDED_PROPS)
)

const p = widget.options?.precision
const precision = typeof p === 'number' && p >= 0 ? p : undefined

// Calculate the step value based on precision or widget options
const stepValue = useNumberStepCalculation(widget.options, precision, true)
</script>
