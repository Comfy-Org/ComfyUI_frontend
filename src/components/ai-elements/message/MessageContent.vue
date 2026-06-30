<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'flex w-full flex-col gap-2 overflow-hidden text-xs text-base-foreground',
        'group-[.is-user]:ml-auto group-[.is-user]:w-fit group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary-background group-[.is-user]:px-4 group-[.is-user]:py-3',
        className
      )
    "
  >
    <slot />
  </div>
</template>
