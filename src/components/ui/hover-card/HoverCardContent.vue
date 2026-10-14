<script setup lang="ts">
import {
  HoverCardContent,
  HoverCardPortal,
  injectHoverCardRootContext,
  useForwardProps
} from 'reka-ui'
import type { HoverCardContentProps } from 'reka-ui'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  side = 'bottom',
  sideOffset = 8,
  ...rest
} = defineProps<HoverCardContentProps & { class?: HTMLAttributes['class'] }>()

const forwarded = useForwardProps(computed(() => rest))

const contentStyle = useModalLiftedZIndex(injectHoverCardRootContext().open)
</script>

<template>
  <HoverCardPortal>
    <HoverCardContent
      v-bind="forwarded"
      :side
      :side-offset
      :style="contentStyle"
      :class="
        cn(
          'z-1700 rounded-lg border border-border-subtle bg-secondary-background p-2.5 shadow-md outline-none',
          className
        )
      "
    >
      <slot />
    </HoverCardContent>
  </HoverCardPortal>
</template>
