<script setup lang="ts">
/* eslint-disable vue/no-unused-properties */
import { reactiveOmit, useEventListener } from '@vueuse/core'
import type {
  DropdownMenuContentEmits,
  DropdownMenuContentProps
} from 'reka-ui'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  injectDropdownMenuRootContext,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = withDefaults(
  defineProps<
    DropdownMenuContentProps & {
      class?: HTMLAttributes['class']
      closeOnScroll?: boolean
    }
  >(),
  {
    closeOnScroll: false,
    sideOffset: 4
  }
)
const emits = defineEmits<DropdownMenuContentEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'closeOnScroll')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
const rootContext = injectDropdownMenuRootContext()

useEventListener(
  window,
  'scroll',
  () => {
    if (props.closeOnScroll) {
      rootContext.onOpenChange(false)
    }
  },
  { capture: true, passive: true }
)
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      v-bind="forwarded"
      :class="
        cn(
          'bg-popover text-popover-foreground z-1700 min-w-32 overflow-hidden rounded-md border p-1 shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          props.class
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
