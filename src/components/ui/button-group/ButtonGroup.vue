<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

interface Props extends PrimitiveProps {
  class?: HTMLAttributes['class']
}

const { as = 'div', class: className = '' } = defineProps<Props>()
</script>

<template>
  <Primitive
    :as
    :class="
      cn('inline-flex items-stretch overflow-hidden rounded-md', className)
    "
  >
    <slot />
  </Primitive>
</template>
