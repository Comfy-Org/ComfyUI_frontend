<template>
  <button
    :id="`tab-${props.value}`"
    role="tab"
    type="button"
    :aria-selected="isActive"
    :aria-controls="`tabpanel-${props.value}`"
    :data-state="isActive ? 'active' : 'inactive'"
    :tabindex="isActive ? 0 : -1"
    :class="
      cn(
        'flex shrink-0 items-center justify-center',
        'cursor-pointer rounded-lg border-none px-2.5 py-2 text-sm transition-all duration-200',
        'focus-visible:ring-ring/20 outline-hidden focus-visible:ring-1',
        isActive
          ? 'bg-interface-menu-component-surface-hovered text-text-primary'
          : 'bg-transparent text-text-secondary hover:bg-button-hover-surface focus:bg-button-hover-surface',
        props.class
      )
    "
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <slot />
  </button>
</template>

<script setup lang="ts" generic="T extends string = string">
import type { HTMLAttributes } from 'vue'

import { computed, inject } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { TAB_LIST_INJECTION_KEY } from './tabKeys'

const props = defineProps<{
  value: T
  class?: HTMLAttributes['class']
}>()

const context = inject(TAB_LIST_INJECTION_KEY)

const isActive = computed(() => context?.modelValue.value === props.value)

function handleClick() {
  context?.select(props.value)
}

function handleKeydown(event: KeyboardEvent) {
  const tablist = (event.currentTarget as HTMLElement).parentElement
  if (!tablist) return

  const tabs = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'))
  const currentIndex = tabs.indexOf(event.currentTarget as HTMLElement)

  let targetIndex = -1

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    targetIndex = (currentIndex + 1) % tabs.length
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    targetIndex = (currentIndex - 1 + tabs.length) % tabs.length
  } else if (event.key === 'Home') {
    targetIndex = 0
  } else if (event.key === 'End') {
    targetIndex = tabs.length - 1
  }

  if (targetIndex !== -1) {
    event.preventDefault()
    tabs[targetIndex].focus()
  }
}
</script>
