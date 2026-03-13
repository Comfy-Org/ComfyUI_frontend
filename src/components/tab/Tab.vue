<template>
  <button
    :id="tabId"
    :class="tabClasses"
    role="tab"
    :aria-selected="isActive"
    :aria-controls="panelId"
    :tabindex="0"
    @click="handleClick"
  >
    <slot />
  </button>
</template>

<script setup lang="ts" generic="T extends string = string">
import type { Ref } from 'vue'
import { computed, inject } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { value, panelId } = defineProps<{
  value: T
  panelId?: string
}>()

const currentValue = inject<Ref<T>>('tabs-value')
const updateValue = inject<(value: T) => void>('tabs-update')

const tabId = computed(() => `tab-${value}`)
const isActive = computed(() => currentValue?.value === value)

const tabClasses = computed(() => {
  return cn(
    // Base styles from TextButton
    'flex shrink-0 items-center justify-center',
    'cursor-pointer rounded-lg px-2.5 py-2 text-sm transition-all duration-200',
    'border-none outline-hidden',
    // State styles with semantic tokens
    isActive.value
      ? 'text-bold bg-interface-menu-component-surface-hovered text-text-primary'
      : 'bg-transparent text-text-secondary hover:bg-button-hover-surface focus:bg-button-hover-surface'
  )
})

const handleClick = () => {
  updateValue?.(value)
}
</script>
