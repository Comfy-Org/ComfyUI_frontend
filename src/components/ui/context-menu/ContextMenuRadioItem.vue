<script setup lang="ts">
/* eslint-disable vue/no-unused-properties */
import { reactiveOmit } from '@vueuse/core'
import type {
  ContextMenuRadioItemEmits,
  ContextMenuRadioItemProps
} from 'reka-ui'
import {
  ContextMenuItemIndicator,
  ContextMenuRadioItem,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  ContextMenuRadioItemProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<ContextMenuRadioItemEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ContextMenuRadioItem
    v-bind="forwarded"
    :class="
      cn(
        'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50',
        props.class
      )
    "
  >
    <span class="absolute left-2 flex size-3.5 items-center justify-center">
      <ContextMenuItemIndicator>
        <span class="size-2 rounded-full bg-current" aria-hidden="true" />
      </ContextMenuItemIndicator>
    </span>
    <slot />
  </ContextMenuRadioItem>
</template>
