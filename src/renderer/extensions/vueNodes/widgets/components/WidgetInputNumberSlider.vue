<template>
  <WidgetLayoutField :widget :display-label :input-id fill-width>
    <template #between><slot name="between" /></template>
    <div
      :class="
        cn(
          WidgetInputBaseClass,
          'flex items-center gap-2 pr-2 pl-3 not-disabled:bg-transparent not-disabled:hover:bg-muted',
          useWidgetHeight()
        )
      "
    >
      <Slider
        :model-value="[modelValue]"
        v-bind="filteredProps"
        class="grow text-xs"
        :step
        :aria-label="widget.name"
        @update:model-value="updateLocalValue"
      />
      <NumberField
        v-model="modelValue"
        :step
        :min="widget.options?.min"
        :max="widget.options?.max"
        :disabled="widget.options?.disabled"
        :format-options="{
          minimumFractionDigits: precision,
          maximumFractionDigits: precision
        }"
        class="h-auto w-auto shrink-0 bg-transparent focus-within:ring-0 hover:bg-transparent"
      >
        <NumberFieldInput
          :id="inputId"
          :aria-label="widget.name"
          class="field-sizing-content w-auto max-w-16 flex-none text-right text-xs"
        />
      </NumberField>
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

import Slider from '@comfyorg/design-system/slider/Slider'
import NumberField from '@comfyorg/design-system/number-field/NumberField'
import NumberFieldInput from '@comfyorg/design-system/number-field/NumberFieldInput'
import { useWidgetHeight } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { useNumberStepCalculation } from '@/renderer/extensions/vueNodes/widgets/composables/useNumberStepCalculation'
import { useWidgetView } from '@/renderer/extensions/vueNodes/widgets/useWidgetView'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { widgetId, displayLabel } = defineProps<{
  widgetId: WidgetId
  displayLabel?: string
}>()

const widget = useWidgetView(() => widgetId)

const modelValue = defineModel<number>({ default: 0 })
const inputId = useId()

const updateLocalValue = (newValue: number[] | undefined): void => {
  if (newValue?.length) modelValue.value = newValue[0]
}

const filteredProps = computed(() =>
  filterWidgetProps(widget.value.options, STANDARD_EXCLUDED_PROPS)
)

const precision = computed(() => {
  const p = widget.value.options.precision
  return typeof p === 'number' && p >= 0 ? p : undefined
})

const step = useNumberStepCalculation(
  () => widget.value.options,
  precision,
  true
)
</script>
