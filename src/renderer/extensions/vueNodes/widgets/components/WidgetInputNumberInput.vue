<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { evaluateInput } from '@/lib/litegraph/src/utils/widget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useWidgetHeight } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

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

// Get the precision value for proper number formatting
const precision = computed(() => {
  const p = props.widget.options?.precision
  // Treat negative or non-numeric precision as undefined
  return typeof p === 'number' && p >= 0 ? p : undefined
})

const step = computed(() => {
  if (props.widget.options?.step2 !== undefined) {
    return props.widget.options.step2
  }
  const step = props.widget.options?.step as number | undefined
  if (step !== undefined && step > 10) {
    return step / 10
  }
  if (precision.value !== undefined) {
    if (precision.value === 0) {
      return 1
    }
    return Number((1 / Math.pow(10, precision.value)).toFixed(precision.value))
  }
  return 0
})

// Disable grouping separators by default unless explicitly enabled by the node author
const useGrouping = computed(() => {
  return props.widget.options?.useGrouping === true
})

// Check if increment/decrement buttons should be disabled due to precision limits
const buttonsDisabled = computed(() => {
  const currentValue = modelValue.value ?? 0
  return (
    !Number.isFinite(currentValue) ||
    Math.abs(currentValue) > Number.MAX_SAFE_INTEGER
  )
})

const buttonTooltip = computed(() => {
  if (buttonsDisabled.value) {
    return 'Increment/decrement disabled: value exceeds JavaScript precision limit (±2^53)'
  }
  return null
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
  <WidgetLayoutField
    data-testid="widget-number-row"
    :widget
    :input-id
    :activate-on-click="false"
    has-leading-button
    label-class="cursor-ew-resize touch-pan-y"
    :root-class="cn('cursor-ew-resize touch-pan-y', props.rootClass)"
  >
    <template #between><slot name="between" /></template>
    <template #default="{ rowElement }">
      <Tooltip :disabled="!buttonTooltip">
        <TooltipTrigger as-child>
          <ScrubableNumberInput
            v-model="modelValue"
            :min="filteredProps.min"
            :max="filteredProps.max"
            :step
            :display-value
            :disabled
            :parse-value
            :input-attrs
            :scrub-element="rowElement"
            :class="
              cn(
                WidgetInputBaseClass,
                'static flex grow pl-0 text-xs not-disabled:bg-transparent',
                useWidgetHeight()
              )
            "
          >
            <template #background>
              <div
                class="pointer-events-none absolute inset-0 size-full overflow-clip rounded-md"
              >
                <div
                  class="size-full bg-primary/15"
                  :style="{ width: `${sliderWidth}%` }"
                />
              </div>
            </template>
            <slot />
          </ScrubableNumberInput>
        </TooltipTrigger>
        <TooltipContent>{{ buttonTooltip }}</TooltipContent>
      </Tooltip>
    </template>
  </WidgetLayoutField>
</template>
