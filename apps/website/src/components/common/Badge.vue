<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{ class?: string }>()
</script>

<template>
  <span
    :class="
      cn(
        'text-primary-warm-gray bg-transparency-ink-t80 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-4 py-1 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',
        className
      )
    "
  >
    <slot />
  </span>
</template>
