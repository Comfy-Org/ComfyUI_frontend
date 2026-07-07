<script setup lang="ts">
import { HoverCardContent, HoverCardPortal, useForwardProps } from 'reka-ui'
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
</script>

<template>
  <HoverCardPortal>
    <HoverCardContent
      v-bind="forwarded"
      :side
      :side-offset
      :class="
        cn(
          'z-1700 rounded-lg border border-white/10 bg-secondary-background p-2.5 shadow-md outline-none',
          className
        )
      "
    >
      <slot />
    </HoverCardContent>
  </HoverCardPortal>
</template>
