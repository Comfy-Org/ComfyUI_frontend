<template>
  <span
    data-testid="credit-badge-required"
    :class="
      cn(
        'flex h-5 shrink-0 items-center bg-input p-1 text-xs',
        variant === 'node' ? 'gap-1 rounded-md py-0.5 pl-2' : 'rounded-full',
        rest && 'rounded-r-none'
      )
    "
  >
    <i
      :class="
        cn(
          'icon-[lucide--coins] aspect-square bg-credit',
          variant === 'node' ? 'size-3.5' : 'h-full w-auto'
        )
      "
    />
    <span class="truncate" v-text="text" />
  </span>
  <span
    v-if="rest"
    data-testid="credit-badge-rest"
    :class="
      cn(
        '-ml-1 flex h-5 max-w-max min-w-0 grow basis-0 items-center truncate bg-input text-xs',
        variant === 'node' ? 'rounded-r-md' : 'rounded-r-full'
      )
    "
  >
    <span class="pr-2" v-text="rest" />
  </span>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { variant = 'default' } = defineProps<{
  text: string
  rest?: string
  variant?: 'default' | 'node'
}>()
</script>
