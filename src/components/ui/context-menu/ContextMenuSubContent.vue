<script setup lang="ts">
/* eslint-disable vue/no-unused-properties */
import { reactiveOmit } from '@vueuse/core'
import type {
  ContextMenuSubContentEmits,
  ContextMenuSubContentProps
} from 'reka-ui'
import { ContextMenuSubContent, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  ContextMenuSubContentProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<ContextMenuSubContentEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ContextMenuSubContent
    v-bind="forwarded"
    :class="
      cn(
        'bg-popover text-popover-foreground z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        props.class
      )
    "
  >
    <slot />
  </ContextMenuSubContent>
</template>
