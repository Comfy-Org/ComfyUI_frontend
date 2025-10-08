<template>
  <div :class="wrapperStyle" @click="focusInput">
    <i class="icon-[lucide--search]" :class="iconColorStyle" />
    <InputText
      ref="input"
      v-model="internalSearchQuery"
      :aria-label="
        placeholder || t('templateWidgets.sort.searchPlaceholder', 'Search...')
      "
      :placeholder="
        placeholder || t('templateWidgets.sort.searchPlaceholder', 'Search...')
      "
      type="text"
      unstyled
      :class="inputStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import InputText from 'primevue/inputtext'
import { computed, onMounted, ref, watch } from 'vue'

import { t } from '@/i18n'
import { cn } from '@/utils/tailwindUtil'

const SEARCH_DEBOUNCE_DELAY_MS = 300

const {
  autofocus = false,
  placeholder,
  showBorder = false,
  size = 'md'
} = defineProps<{
  autofocus?: boolean
  placeholder?: string
  showBorder?: boolean
  size?: 'md' | 'lg'
}>()

// defineModel without arguments uses 'modelValue' as the prop name
const searchQuery = defineModel<string>()

// Internal search query state for immediate UI updates
const internalSearchQuery = ref<string>(searchQuery.value ?? '')

// Create debounced function to update the parent model
const updateSearchQuery = useDebounceFn((value: string) => {
  searchQuery.value = value
}, SEARCH_DEBOUNCE_DELAY_MS)

// Watch internal query changes and trigger debounced update
watch(internalSearchQuery, (newValue) => {
  void updateSearchQuery(newValue)
})

// Sync external changes back to internal state
watch(searchQuery, (newValue) => {
  if (newValue !== internalSearchQuery.value) {
    internalSearchQuery.value = newValue || ''
  }
})

const input = ref<{ $el: HTMLElement } | null>()
const focusInput = () => {
  if (input.value && input.value.$el) {
    input.value.$el.focus()
  }
}

onMounted(() => autofocus && focusInput())

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
