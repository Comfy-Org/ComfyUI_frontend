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
        'flex h-8 shrink-0 items-center justify-center',
        'px-2.5',
        tabStateVariants({ active: isActive }),
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
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'
import { computed, inject } from 'vue'

import { tabStateVariants } from './tab.variants'
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
