<script setup lang="ts">
import type { PopoverContentEmits, PopoverContentProps } from 'reka-ui'
import {
  PopoverContent,
  injectPopoverRootContext,
  useForwardPropsEmits,
  PopoverPortal
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { usePopoverViewportDismiss } from './usePopoverViewportDismiss'

defineOptions({
  inheritAttrs: false
})

const {
  align = 'center',
  sideOffset = 4,
  collisionPadding = 8,
  class: className,
  dismissOnViewportChange = false,
  ...restProps
} = defineProps<
  PopoverContentProps & {
    class?: HTMLAttributes['class']
    dismissOnViewportChange?: boolean
  }
>()
const emits = defineEmits<PopoverContentEmits>()

const delegatedProps = computed(() => ({
  align,
  sideOffset,
  collisionPadding,
  ...restProps
}))

const forwarded = useForwardPropsEmits(delegatedProps, emits)
const rootContext = injectPopoverRootContext()

usePopoverViewportDismiss(
  computed({
    get: () => dismissOnViewportChange && rootContext.open.value,
    set: (open) => rootContext.onOpenChange(open)
  }),
  rootContext.triggerElement
)
</script>

<template>
  <PopoverPortal :key="Number(restProps.forceMount || rootContext.open.value)">
    <PopoverContent
      data-slot="popover-content"
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'z-overlay w-72 origin-(--reka-popover-content-transform-origin) rounded-md border bg-background p-4 text-foreground shadow-md outline-none',
          'overflow-auto [:where(&)]:max-h-(--reka-popover-content-available-height) [:where(&)]:max-w-(--reka-popover-content-available-width)',
          'data-[state=closed]:animate-out data-[state=open]:animate-in',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
