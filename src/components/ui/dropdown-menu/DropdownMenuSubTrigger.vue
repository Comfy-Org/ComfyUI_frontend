<script setup lang="ts">
/* eslint-disable vue/no-unused-properties */
import { reactiveOmit } from '@vueuse/core'
import type { DropdownMenuSubTriggerProps } from 'reka-ui'
import { DropdownMenuSubTrigger, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  DropdownMenuSubTriggerProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuSubTrigger
    v-bind="forwardedProps"
    :class="
      cn(
        'focus:bg-accent data-[state=open]:bg-accent flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none',
        props.class
      )
    "
  >
    <slot />
    <i class="ml-auto icon-[lucide--chevron-right] size-4" aria-hidden="true" />
  </DropdownMenuSubTrigger>
</template>
