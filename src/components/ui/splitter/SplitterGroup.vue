<script setup lang="ts">
import type { SplitterGroupEmits, SplitterGroupProps } from 'reka-ui'
import { SplitterGroup, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  direction = 'horizontal',
  class: className,
  ...restProps
} = defineProps<
  Omit<SplitterGroupProps, 'direction'> & {
    direction?: SplitterGroupProps['direction']
    class?: HTMLAttributes['class']
  }
>()
const emit = defineEmits<SplitterGroupEmits>()
const forwarded = useForwardPropsEmits(restProps, emit)
</script>

<template>
  <SplitterGroup
    v-bind="forwarded"
    :direction
    :class="
      cn('flex size-full', direction === 'vertical' && 'flex-col', className)
    "
  >
    <slot />
  </SplitterGroup>
</template>
