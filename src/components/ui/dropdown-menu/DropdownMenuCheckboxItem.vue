<script setup lang="ts">
/* eslint-disable vue/no-unused-properties */
import { reactiveOmit } from '@vueuse/core'
import type {
  DropdownMenuCheckboxItemEmits,
  DropdownMenuCheckboxItemProps
} from 'reka-ui'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator,
  useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  DropdownMenuCheckboxItemProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<DropdownMenuCheckboxItemEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuCheckboxItem
    v-bind="forwarded"
    :class="
      cn(
        'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm transition-colors outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50',
        props.class
      )
    "
  >
    <span class="absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuItemIndicator>
        <i class="icon-[lucide--check] size-4" aria-hidden="true" />
      </DropdownMenuItemIndicator>
    </span>
    <slot />
  </DropdownMenuCheckboxItem>
</template>
