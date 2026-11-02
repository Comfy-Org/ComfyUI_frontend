<template>
  <WidgetLayoutField :widget="widget" :input-id="inputId" fill-width>
    <template #between><slot name="between" /></template>
    <div
      :class="
        cn(
          WidgetInputBaseClass,
          'flex items-center gap-2 pr-2 pl-3 not-disabled:hover:bg-muted',
          unifiedRows && 'not-disabled:bg-transparent',
          useWidgetHeight()
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
      <NumberField
        v-model="modelValue"
        :step="stepValue"
        :min="widget.options?.min"
        :max="widget.options?.max"
        :disabled="widget.options?.disabled"
        :format-options="{
          minimumFractionDigits: precision,
          maximumFractionDigits: precision
        }"
        class="h-auto w-16 shrink-0 bg-transparent hover:bg-transparent"
      >
        <NumberFieldInput
          :id="inputId"
          :aria-label="widget.name"
          :class="cn('text-xs', unifiedRows && 'text-right')"
        />
      </NumberField>
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, inject, useId } from 'vue'

import Slider from '@comfyorg/design-system/slider/Slider'
import NumberField from '@comfyorg/design-system/number-field/NumberField'
import NumberFieldInput from '@comfyorg/design-system/number-field/NumberFieldInput'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { UnifiedWidgetRowsKey } from '@/types/widgetRowLayout'
import { useWidgetHeight } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { useNumberStepCalculation } from '@/renderer/extensions/vueNodes/widgets/composables/useNumberStepCalculation'
import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { widget } = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const modelValue = defineModel<number>({ default: 0 })
const inputId = useId()
const unifiedRows = inject(UnifiedWidgetRowsKey, false)

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
