<script setup lang="ts">
/* eslint-disable vue/no-unused-properties */
import { reactiveOmit } from '@vueuse/core'
import type { ContextMenuSubTriggerProps } from 'reka-ui'
import { ContextMenuSubTrigger, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  ContextMenuSubTriggerProps & {
    class?: HTMLAttributes['class']
    inset?: boolean
  }
>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <ContextMenuSubTrigger
    v-bind="forwardedProps"
    :class="
      cn(
        'focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none',
        inset && 'pl-8',
        props.class
      )
    "
  >
    <slot />
    <i class="ml-auto icon-[lucide--chevron-right] size-4" aria-hidden="true" />
  </ContextMenuSubTrigger>
</template>
