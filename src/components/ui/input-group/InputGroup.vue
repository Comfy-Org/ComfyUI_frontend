<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="input-group"
    role="group"
    :class="
      cn(
        'group/input-group relative flex h-10 w-full min-w-0 items-center rounded-lg bg-secondary-background text-sm text-base-foreground outline-none',
        'has-[>[data-align=inline-start]]:*:data-[slot=input-group-control]:pl-2',
        'has-[>[data-align=inline-end]]:*:data-[slot=input-group-control]:pr-2',
        'has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-border-default',
        'has-[[data-slot=input-group-control][aria-invalid=true]]:ring-1 has-[[data-slot=input-group-control][aria-invalid=true]]:ring-destructive-background',
        className
      )
    "
  >
    <slot />
  </div>
</template>
