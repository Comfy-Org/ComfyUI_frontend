<template>
  <div
    :class="
      cn(
        WidgetInputBaseClass,
        'inline-flex items-center justify-center gap-1 p-1'
      )
    "
  >
    <button
      v-for="(option, index) in options"
      :key="getOptionValue(option, index)"
      :class="
        cn(
          'flex h-6 min-w-[4ch] flex-1 items-center justify-center gap-1 truncate rounded px-5 py-[5px] transition-all duration-150 ease-in-out',
          'border-none bg-transparent',
          'text-center text-xs font-normal',
          {
            'bg-interface-menu-component-surface-selected':
              isSelected(index) && !disabled,
            'hover:bg-interface-menu-component-surface-selected/50':
              !isSelected(index) && !disabled,
            'cursor-not-allowed opacity-50': disabled,
            'cursor-pointer': !disabled
          },
          isSelected(index) && !disabled
            ? 'text-text-primary'
            : 'text-text-secondary'
        )
      "
      :disabled="disabled"
      @click="handleSelect(index)"
    >
      {{ getOptionLabel(option) }}
    </button>
  </div>
</template>

<script
  setup
  lang="ts"
  generic="
    T extends string | number | { label: string; value: string | number }
  "
>
import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from '../layout'

type ModelValue = T extends object ? T['value'] : T

interface Props {
  modelValue: ModelValue | null | undefined
  options: T[]
  optionLabel?: string // PrimeVue compatible prop
  optionValue?: string // PrimeVue compatible prop
  disabled?: boolean
}

interface Emits {
  'update:modelValue': [value: ModelValue]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  optionLabel: 'label',
  optionValue: 'value'
})

const emit = defineEmits<Emits>()

// handle both string/number arrays and object arrays with PrimeVue compatibility
const getOptionValue = (option: T, index: number): ModelValue => {
  if (typeof option !== 'object') {
    return option as ModelValue
  }

  const valueField = props.optionValue
  const value =
    (option as any)[valueField] ??
    option.value ??
    (option as any).name ??
    option.label ??
    index
  return value
}

// for display with PrimeVue compatibility
const getOptionLabel = (option: T): string => {
  if (typeof option === 'object' && option !== null) {
    const labelField = props.optionLabel
    return (
      (option as any)[labelField] ??
      option.label ??
      (option as any).name ??
      option.value ??
      String(option)
    )
  }
  return String(option)
}

const isSelected = (index: number): boolean => {
  const optionValue = getOptionValue(props.options[index], index)
  return String(optionValue) === String(props.modelValue ?? '')
}

const handleSelect = (index: number) => {
  if (props.disabled) return

  const optionValue = getOptionValue(props.options[index], index)
  emit('update:modelValue', optionValue)
}
</script>
