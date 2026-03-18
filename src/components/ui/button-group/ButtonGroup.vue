<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

interface Props extends PrimitiveProps {
  class?: HTMLAttributes['class']
}

const { as = 'div', class: className = '', ...restProps } = defineProps<Props>()
const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <Primitive
    v-bind="forwardedProps"
    :as
    :class="
      cn('inline-flex items-stretch overflow-hidden rounded-md', className)
    "
  >
    <slot />
  </Primitive>
</template>
