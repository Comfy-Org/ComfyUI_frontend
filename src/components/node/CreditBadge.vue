<template>
  <span
    :class="
      cn(
        'flex h-5 items-center bg-component-node-widget-background p-1 text-xs shrink-0',
        rest ? 'rounded-l-full pr-1' : 'rounded-full'
      )
    "
  >
    <i class="h-full icon-[lucide--component] bg-amber-400" />
    <span class="truncate" v-text="text" />
  </span>
  <span
    v-if="rest"
    class="-ml-2.5 min-w-0 max-w-max grow-1 basis-0 truncate rounded-r-full bg-component-node-widget-background"
  >
    <span class="pr-2" v-text="rest" />
  </span>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  text: string
  rest?: string
}>()
</script>
