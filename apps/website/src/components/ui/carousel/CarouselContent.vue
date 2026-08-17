<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { WithClassAsProps } from './interface'
import { useCarousel } from './useCarousel'

defineOptions({
  inheritAttrs: false
})

const props = defineProps<WithClassAsProps>()

const { carouselRef, orientation } = useCarousel()
</script>

<template>
  <div ref="carouselRef" class="overflow-hidden">
    <div
      :class="
        cn(
          'flex',
          orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col',
          props.class
        )
      "
      v-bind="$attrs"
    >
      <slot />
    </div>
  </div>
</template>
