<template>
  <div :class="wrapperStyle">
    <i-lucide:search :class="iconColorStyle" />
    <InputText
      v-model="searchQuery"
      :placeholder="placeHolder || 'Search...'"
      type="text"
      unstyled
      class="w-full p-0 border-none outline-none bg-transparent text-sm text-neutral dark-theme:text-white"
    />
  </div>
</template>

<script setup lang="ts">
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
  const baseClasses =
    'flex w-full items-center gap-2 bg-white dark-theme:bg-zinc-800'

  if (showBorder) {
    return `${baseClasses} rounded p-2 border border-solid border-zinc-200 dark-theme:border-zinc-700`
  }

  // Size-specific classes for non-bordered variant
  const sizeClasses =
    size === 'lg'
      ? 'h-10 px-4 py-2' // Larger height and padding for lg
      : 'h-8 px-2 py-1.5' // Default md size

  return `${baseClasses} rounded-lg ${sizeClasses}`
})

const iconColorStyle = computed(() => {
  return !showBorder ? 'text-neutral' : 'text-zinc-300 dark-theme:text-zinc-700'
})
</script>
