<script setup lang="ts">
import {
  HoverCardContent,
  injectHoverCardRootContext,
  useForwardProps,
  HoverCardPortal
} from 'reka-ui'
import type { HoverCardContentProps } from 'reka-ui'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  side = 'bottom',
  sideOffset = 8,
  ...rest
} = defineProps<HoverCardContentProps & { class?: HTMLAttributes['class'] }>()

const forwarded = useForwardProps(computed(() => rest))

const { open } = injectHoverCardRootContext()
</script>

<template>
  <HoverCardPortal :key="Number(rest.forceMount || open)">
    <HoverCardContent
      v-bind="forwarded"
      :side
      :side-offset
      :class="
        cn(
          'z-overlay rounded-lg border border-border/50 bg-secondary p-2.5 shadow-md outline-none',
          className
        )
      "
    >
      <slot />
    </HoverCardContent>
  </HoverCardPortal>
</template>
