<script setup lang="ts">
import type { ToggleGroupItemProps } from 'reka-ui'
import { ToggleGroupItem, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, inject } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import type { ToggleGroupItemVariants } from './toggleGroup.variants'
import { toggleGroupItemVariants } from './toggleGroup.variants'

interface Props extends ToggleGroupItemProps {
  class?: HTMLAttributes['class']
  variant?: ToggleGroupItemVariants['variant']
  size?: ToggleGroupItemVariants['size']
}

const {
  class: className,
  variant,
  size = 'default',
  ...restProps
} = defineProps<Props>()

const contextVariant = inject<ToggleGroupItemVariants['variant']>(
  'toggleGroupVariant',
  'default'
)

const delegatedProps = computed(() => restProps)
const forwardedProps = useForwardProps(delegatedProps)

const resolvedVariant = computed(() => variant ?? contextVariant ?? 'default')
</script>

<template>
  <ToggleGroupItem
    v-bind="forwardedProps"
    :class="
      cn(
        toggleGroupItemVariants({ variant: resolvedVariant, size }),
        'flex-1 min-w-0 truncate',
        className
      )
    "
  >
    <slot />
  </ToggleGroupItem>
</template>
