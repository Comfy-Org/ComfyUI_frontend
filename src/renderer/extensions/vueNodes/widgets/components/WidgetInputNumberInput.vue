<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { evaluateInput } from '@/lib/litegraph/src/utils/widget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { n } = useI18n()

const props = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const widgetContainer = useTemplateRef<HTMLDivElement>('widgetContainer')
const inputField = useTemplateRef<HTMLInputElement>('inputField')
const textEdit = ref(false)
onClickOutside(widgetContainer, () => {
  if (textEdit.value) {
    textEdit.value = false
  }
})

const decimalSeparator = computed(() => n(1.1).replace(/\p{Number}/gu, ''))
const groupSeparator = computed(() => n(11111).replace(/\p{Number}/gu, ''))
function unformatValue(value: string) {
  return value
    .replaceAll(groupSeparator.value, '')
    .replaceAll(decimalSeparator.value, '.')
}

const modelValue = defineModel<number>({ default: 0 })

const formattedValue = computed(() =>
  n(dragValue.value ?? modelValue.value, {
    useGrouping: useGrouping.value,
    minimumFractionDigits: precision.value,
    maximumFractionDigits: precision.value
  })
)

function updateValue(e: UIEvent) {
  const { target } = e
  if (!(target instanceof HTMLInputElement)) return
  const parsed = evaluateInput(unformatValue(target.value))
  if (parsed !== undefined)
    modelValue.value = Math.min(
      filteredProps.value.max,
      Math.max(filteredProps.value.min, parsed)
    )
  else target.value = formattedValue.value

  textEdit.value = false
}

const sharedButtonClass = 'w-8 bg-transparent border-0 text-sm text-smoke-700'
const canDecrement = computed(
  () =>
    modelValue.value > filteredProps.value.min &&
    !props.widget.options?.disabled
)
const canIncrement = computed(
  () =>
    modelValue.value < filteredProps.value.max &&
    !props.widget.options?.disabled
)

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, INPUT_EXCLUDED_PROPS)
)

// Get the precision value for proper number formatting
const precision = computed(() => {
  const p = props.widget.options?.precision
  // Treat negative or non-numeric precision as undefined
  return typeof p === 'number' && p >= 0 ? p : undefined
})

// Calculate the step value based on precision or widget options
const stepValue = computed(() => {
  // Use step2 (correct input spec value) if available
  if (props.widget.options?.step2 !== undefined) {
    return Number(props.widget.options.step2)
  }
  // Use step / 10 for custom large step values (> 10) to match litegraph behavior
  // This is important for extensions like Impact Pack that use custom step values (e.g., 640)
  // We skip default step values (1, 10) to avoid affecting normal widgets
  const step = props.widget.options?.step
  if (step !== undefined && step > 10) {
    return Number(step) / 10
  }
  // Otherwise, derive from precision
  if (precision.value !== undefined) {
    if (precision.value === 0) {
      return 1
    }
    // For precision > 0, step = 1 / (10^precision)
    // precision 1 → 0.1, precision 2 → 0.01, etc.
    return Number((1 / Math.pow(10, precision.value)).toFixed(precision.value))
  }
  // Default to 'any' for unrestricted stepping
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

function updateValueBy(delta: number) {
  modelValue.value = Math.min(
    filteredProps.value.max,
    Math.max(filteredProps.value.min, modelValue.value + delta)
  )
}

const dragValue = ref<number>()
const dragDelta = ref(0)
function handleMouseDown(e: PointerEvent) {
  if (props.widget.options?.disabled) return
  const { target } = e
  if (!(target instanceof HTMLElement)) return
  target.setPointerCapture(e.pointerId)
  dragValue.value = modelValue.value
  dragDelta.value = 0
}
function handleMouseMove(e: PointerEvent) {
  if (dragValue.value === undefined) return
  dragDelta.value += e.movementX
  const unclippedValue =
    dragValue.value + ((dragDelta.value / 10) | 0) * stepValue.value
  dragDelta.value %= 10
  dragValue.value = Math.min(
    filteredProps.value.max,
    Math.max(filteredProps.value.min, unclippedValue)
  )
}
function handleMouseUp() {
  const newValue = dragValue.value
  if (newValue === undefined) return
  modelValue.value = newValue
  dragValue.value = undefined

  if (dragDelta.value === 0) {
    textEdit.value = true
    inputField.value?.focus()
    inputField.value?.setSelectionRange(0, -1)
  }
  dragDelta.value = 0
}

const buttonTooltip = computed(() => {
  if (buttonsDisabled.value) {
    return 'Increment/decrement disabled: value exceeds JavaScript precision limit (±2^53)'
  }
  return null
})
</script>

<template>
  <WidgetLayoutField :widget>
    <div
      ref="widgetContainer"
      v-tooltip="buttonTooltip"
      v-bind="filteredProps"
      :aria-label="widget.name"
      :class="cn(WidgetInputBaseClass, 'grow text-xs flex h-7')"
    >
      <button
        v-if="!buttonsDisabled"
        data-testid="decrement"
        :class="
          cn(sharedButtonClass, 'pi pi-minus', !canDecrement && 'opacity-60')
        "
        :disabled="!canDecrement"
        tabindex="-1"
        @click="modelValue -= stepValue"
      />
      <div class="relative min-w-[4ch] flex-1 py-1.5 my-0.25">
        <input
          ref="inputField"
          :aria-valuenow="dragValue ?? modelValue"
          :aria-valuemin="filteredProps.min"
          :aria-valuemax="filteredProps.max"
          :class="
            cn(
              'bg-transparent border-0 focus:outline-0 p-1 truncate text-sm absolute inset-0'
            )
          "
          inputmode="decimal"
          :value="formattedValue"
          role="spinbutton"
          tabindex="0"
          :disabled="widget.options?.disabled"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          @blur="updateValue"
          @keyup.enter="updateValue"
          @keydown.up.prevent="updateValueBy(stepValue)"
          @keydown.down.prevent="updateValueBy(-stepValue)"
          @keydown.page-up.prevent="updateValueBy(10 * stepValue)"
          @keydown.page-down.prevent="updateValueBy(-10 * stepValue)"
          @dragstart.prevent
        />
        <div
          :class="
            cn(
              'absolute inset-0 z-10 cursor-ew-resize',
              textEdit && 'hidden pointer-events-none'
            )
          "
          @pointerdown="handleMouseDown"
          @pointermove="handleMouseMove"
          @pointerup="handleMouseUp"
          @pointercancel="
            () => {
              dragValue = undefined
              dragDelta = 0
            }
          "
        />
      </div>

      <slot />
      <button
        v-if="!buttonsDisabled"
        data-testid="increment"
        :class="
          cn(sharedButtonClass, 'pi pi-plus', !canIncrement && 'opacity-60')
        "
        :disabled="!canIncrement"
        tabindex="-1"
        @click="modelValue += stepValue"
      />
    </div>
  </WidgetLayoutField>
</template>
