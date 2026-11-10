<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import { evaluateInput } from '@/lib/litegraph/src/utils/widget'
import { useNumberStepCalculation } from '@/renderer/extensions/vueNodes/widgets/composables/useNumberStepCalculation'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import WidgetLayoutFieldLabel from './layout/WidgetLayoutFieldLabel.vue'

const { locale } = useI18n()
const inputId = useId()

const props = defineProps<{
  widget: SimplifiedWidget<number>
  rootClass?: string
}>()

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale.value, options).format(value)
}

const decimalSeparator = computed(() =>
  formatNumber(1.1).replace(/\p{Number}/gu, '')
)
const groupSeparator = computed(() =>
  formatNumber(11111).replace(/\p{Number}/gu, '')
)
function unformatValue(value: string) {
  return value
    .replaceAll(groupSeparator.value, '')
    .replaceAll(decimalSeparator.value, '.')
}

const modelValue = defineModel<number>({ default: 0 })

const displayValue = computed(() => {
  const value = modelValue.value
  if ((value as unknown) === '' || !isFinite(value)) return `${value}`

  const options: Intl.NumberFormatOptions = {
    useGrouping: useGrouping.value
  }
  if (precision.value !== undefined) {
    options.minimumFractionDigits = precision.value
    options.maximumFractionDigits = precision.value
  }
  return formatNumber(value, options)
})

function parseValue(raw: string): number | undefined {
  return evaluateInput(unformatValue(raw))
}

interface NumericWidgetOptions {
  min: number
  max: number
  step?: number
  step2?: number
  precision?: number
  disabled?: boolean
  useGrouping?: boolean
}

const filteredProps = computed(() => {
  const filtered = filterWidgetProps(props.widget.options, INPUT_EXCLUDED_PROPS)
  return filtered as Partial<NumericWidgetOptions>
})

const disabled = computed(() => props.widget.options?.disabled ?? false)

const precision = computed(() => {
  const p = props.widget.options?.precision
  return typeof p === 'number' && p >= 0 ? p : undefined
})

const step = useNumberStepCalculation(() => props.widget.options, precision)

const useGrouping = computed(() => {
  return props.widget.options?.useGrouping === true
})

const sliderWidth = computed(() => {
  const { max, min, step } = filteredProps.value
  if (
    min === undefined ||
    max === undefined ||
    step === undefined ||
    (max - min) / step >= 100
  )
    return 0
  const ratio = (modelValue.value - min) / (max - min)
  return (ratio * 100).toFixed(0)
})

const inputAttrs = computed(() => ({
  id: inputId,
  'aria-label': props.widget.label || props.widget.name,
  'aria-valuenow': modelValue.value,
  'aria-valuemin': filteredProps.value.min,
  'aria-valuemax': filteredProps.value.max,
  role: 'spinbutton',
  tabindex: 0
}))
</script>

<template>
  <ScrubableNumberInput
    v-model="modelValue"
    data-testid="widget-number-row"
    :min="filteredProps.min"
    :max="filteredProps.max"
    :step
    :display-value
    :disabled
    :parse-value
    :input-attrs
    :class="
      cn('cursor-ew-resize touch-pan-y', widget.borderStyle, props.rootClass)
    "
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <template #label>
      <WidgetLayoutFieldLabel :widget :input-id class="pl-2" />
    </template>
    <template #between><slot name="between" /></template>
    <template #background>
      <div
        class="pointer-events-none absolute inset-0 -z-10 overflow-clip rounded-md"
      >
        <div
          class="size-full bg-primary/15"
          :style="{ width: `${sliderWidth}%` }"
        />
      </div>
    </template>
    <slot />
  </ScrubableNumberInput>
</template>
