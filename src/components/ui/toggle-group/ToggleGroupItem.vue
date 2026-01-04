<script setup lang="ts">
/* eslint-disable vue/no-unused-properties */
import { reactiveOmit } from '@vueuse/core'
import type { ToggleGroupItemProps } from 'reka-ui'
import { ToggleGroupItem, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { inject } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { toggleGroupItemVariants } from './toggleGroup.variants'
import type { ToggleGroupItemVariants } from './toggleGroup.variants'

const props = defineProps<
  ToggleGroupItemProps & {
    class?: HTMLAttributes['class']
    variant?: ToggleGroupItemVariants['variant']
  }
>()

const context = inject<{ variant?: ToggleGroupItemVariants['variant'] }>(
  'toggleGroup'
)

const delegatedProps = reactiveOmit(props, 'class', 'variant')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <ToggleGroupItem
    v-slot="slotProps"
    v-bind="forwardedProps"
    :class="
      cn(
        toggleGroupItemVariants({
          variant: context?.variant || variant
        }),
        props.class
      )
    "
  >
    <span class="truncate min-w-0">
      <slot v-bind="slotProps" />
    </span>
  </ToggleGroupItem>
</template>
