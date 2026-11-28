<script setup lang="ts">
import {
  HoverCardContent,
  injectHoverCardRootContext,
  useForwardPropsEmits,
  HoverCardPortal
} from 'reka-ui'
import type {
  FocusOutsideEvent,
  HoverCardContentProps,
  PointerDownOutsideEvent
} from 'reka-ui'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  side = 'bottom',
  sideOffset = 8,
  ...rest
} = defineProps<HoverCardContentProps & { class?: HTMLAttributes['class'] }>()

const emits = defineEmits<{
  escapeKeyDown: [event: KeyboardEvent]
  pointerDownOutside: [event: PointerDownOutsideEvent]
  focusOutside: [event: FocusOutsideEvent]
  interactOutside: [event: PointerDownOutsideEvent | FocusOutsideEvent]
}>()

const forwarded = useForwardPropsEmits(
  computed(() => rest),
  emits
)

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
