<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { SwapProduct } from '../../../lib/workshop/hand-product-swap/examples'

const { product, name, selected } = defineProps<{
  product: SwapProduct
  name: string
  selected: boolean
}>()

const emit = defineEmits<{ pick: [] }>()
</script>

<template>
  <button
    type="button"
    role="radio"
    :aria-checked="selected"
    class="group flex min-w-0 flex-col gap-1 text-left focus-visible:outline-none disabled:opacity-40"
    @click="emit('pick')"
  >
    <span
      :class="
        cn(
          'relative block aspect-square w-full rounded-lg bg-[radial-gradient(circle_at_50%_40%,var(--color-transparency-white-t8),var(--color-transparency-white-t4))] ring-1 ring-transparency-white-t8 transition group-hover:ring-transparency-white-t20 group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60',
          selected &&
            'ring-2 ring-primary-warm-white group-hover:ring-primary-warm-white'
        )
      "
    >
      <img
        :src="product.url"
        alt=""
        draggable="false"
        class="absolute inset-0 m-auto max-h-[78%] max-w-[78%] object-contain drop-shadow-md"
      />
    </span>
    <span
      :class="
        cn(
          'truncate text-xs text-primary-warm-gray group-hover:text-primary-comfy-canvas',
          selected && 'text-primary-warm-white'
        )
      "
      >{{ name }}</span
    >
  </button>
</template>
