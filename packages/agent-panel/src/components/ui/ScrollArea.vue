<script setup lang="ts">
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport
} from 'reka-ui'

import { cn } from '@/utils/cn'

const { class: cls, viewportClass } = defineProps<{
  class?: string
  viewportClass?: string
}>()
</script>

<template>
  <ScrollAreaRoot :class="cn('relative overflow-hidden', cls)" type="hover">
    <ScrollAreaViewport :class="cn('size-full', viewportClass)">
      <slot />
    </ScrollAreaViewport>
    <ScrollAreaScrollbar
      orientation="vertical"
      class="flex w-2 touch-none p-0.5 transition-colors select-none"
    >
      <ScrollAreaThumb
        class="bg-agent-border-strong relative flex-1 rounded-full"
      />
    </ScrollAreaScrollbar>
  </ScrollAreaRoot>
</template>
