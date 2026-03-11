<template>
  <TabsTrigger
    :value="value"
    :class="
      cn(
        'flex shrink-0 items-center justify-center',
        'cursor-pointer rounded-lg px-2.5 py-2 text-sm transition-all duration-200',
        'border-none outline-hidden',
        'data-[state=active]:text-bold data-[state=active]:bg-interface-menu-component-surface-hovered data-[state=active]:text-text-primary',
        'data-[state=inactive]:bg-transparent data-[state=inactive]:text-text-secondary data-[state=inactive]:hover:bg-button-hover-surface data-[state=inactive]:focus:bg-button-hover-surface',
        props.class
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>

<script setup lang="ts" generic="T extends string = string">
import type { HTMLAttributes } from 'vue'

import { TabsTrigger } from 'reka-ui'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  value: T
  class?: HTMLAttributes['class']
}>()
</script>
