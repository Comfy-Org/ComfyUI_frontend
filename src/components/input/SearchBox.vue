<template>
  <div :class="wrapperStyle">
    <i-lucide:search :class="iconColorStyle" />
    <InputText
      v-model="searchQuery"
      :placeholder="placeHolder || 'Search...'"
      type="text"
      unstyled
      :class="inputStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

const {
  placeHolder,
  showBorder = false,
  size = 'md'
} = defineProps<{
  placeHolder?: string
  showBorder?: boolean
  size?: 'md' | 'lg'
}>()
// defineModel without arguments uses 'modelValue' as the prop name
const searchQuery = defineModel<string>()

const wrapperStyle = computed(() => {
  const baseClasses = [
    'relative flex w-full items-center gap-2',
    'bg-white dark-theme:bg-zinc-800',
    'cursor-text'
  ]

  if (showBorder) {
    return cn(
      ...baseClasses,
      'rounded p-2',
      'border border-solid',
      'border-zinc-200 dark-theme:border-zinc-700'
    )
  }

  // Size-specific classes matching button sizes for consistency
  const sizeClasses = {
    md: 'h-8 px-2 py-1.5', // Matches button sm size
    lg: 'h-10 px-4 py-2' // Matches button md size
  }[size]

  return cn(...baseClasses, 'rounded-lg', sizeClasses)
})

const inputStyle = computed(() => {
  return cn(
    'absolute inset-0 w-full h-full pl-11',
    'border-none outline-none bg-transparent',
    'text-sm text-neutral dark-theme:text-white'
  )
})

const iconColorStyle = computed(() => {
  return cn(
    !showBorder ? 'text-neutral' : ['text-zinc-300', 'dark-theme:text-zinc-700']
  )
})
</script>
