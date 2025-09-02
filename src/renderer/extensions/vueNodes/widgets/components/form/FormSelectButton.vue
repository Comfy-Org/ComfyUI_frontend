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
          {
            'text-neutral-900': isSelected(option) && !disabled,
            'text-zinc-500': !isSelected(option) || disabled
          }
        )
      "
      :disabled="disabled"
      @click="handleSelect(option)"
    >
      {{ getOptionLabel(option) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from '../layout'

interface Props {
  modelValue: string | null | undefined
  options: any[]
  disabled?: boolean
}

interface Emits {
  'update:modelValue': [value: string]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<Emits>()

// handle both string/number arrays and object arrays
const getOptionValue = (option: any, index: number): string => {
  if (typeof option === 'object' && option !== null) {
    const value = option.value ?? option.name ?? option.label ?? index
    return String(value)
  }
  return String(option)
}

// for display
const getOptionLabel = (option: any): string => {
  if (typeof option === 'object' && option !== null) {
    return option.label ?? option.name ?? option.value ?? String(option)
  }
  return String(option)
}

const isSelected = (option: any): boolean => {
  const optionValue = getOptionValue(option, props.options.indexOf(option))
  return optionValue === String(props.modelValue ?? '')
}

const handleSelect = (option: any) => {
  if (props.disabled) return

  const optionValue = getOptionValue(option, props.options.indexOf(option))
  emit('update:modelValue', optionValue)
}
</script>
