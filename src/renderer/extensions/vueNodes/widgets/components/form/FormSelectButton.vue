<template>
  <div
    :class="
      cn(
        WidgetInputBaseClass,
        'p-1 inline-flex justify-center items-center gap-1'
      )
    "
  >
    <button
      v-for="(option, index) in options"
      :key="getOptionValue(option, index)"
      :class="
        cn(
          'flex-1 h-6 px-5 py-[5px] rounded flex justify-center items-center gap-1 transition-all duration-150 ease-in-out',
          'bg-transparent border-none',
          'text-center text-xs font-normal',
          {
            'bg-white': isSelected(option) && !disabled,
            'hover:bg-zinc-200/50': !isSelected(option) && !disabled,
            'opacity-50 cursor-not-allowed': disabled,
            'cursor-pointer': !disabled
          },
          isSelected(option) && !disabled
            ? 'text-neutral-900'
            : 'text-secondary'
        )
      "
      :disabled="disabled"
      @click="handleSelect(option)"
    >
      {{ getOptionLabel(option) }}
    </button>
  </div>
</template>

<script
  setup
  lang="ts"
  generic="T extends string | number | { label: string; value: any }"
>
import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from '../layout'

interface Props {
  modelValue: string | null | undefined
  options: T[]
  optionLabel?: string // PrimeVue compatible prop
  optionValue?: string // PrimeVue compatible prop
  disabled?: boolean
}

interface Emits {
  'update:modelValue': [value: string]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  optionLabel: 'label',
  optionValue: 'value'
})

const emit = defineEmits<Emits>()

// handle both string/number arrays and object arrays with PrimeVue compatibility
const getOptionValue = (option: T, index: number): string => {
  if (typeof option === 'object' && option !== null) {
    const valueField = props.optionValue
    const value =
      (option as any)[valueField] ??
      (option as any).value ??
      (option as any).name ??
      (option as any).label ??
      index
    return String(value)
  }
  return String(option)
}

// for display with PrimeVue compatibility
const getOptionLabel = (option: T): string => {
  if (typeof option === 'object' && option !== null) {
    const labelField = props.optionLabel
    return (
      (option as any)[labelField] ??
      (option as any).label ??
      (option as any).name ??
      (option as any).value ??
      String(option)
    )
  }
  return String(option)
}

const isSelected = (option: T): boolean => {
  const optionValue = getOptionValue(option, props.options.indexOf(option))
  return optionValue === String(props.modelValue ?? '')
}

const handleSelect = (option: T) => {
  if (props.disabled) return

  const optionValue = getOptionValue(option, props.options.indexOf(option))
  emit('update:modelValue', optionValue)
}
</script>
